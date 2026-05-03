"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Phone, MessageCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type VoiceState =
  | "idle"
  | "connecting"
  | "listening"
  | "recording"
  | "processing"
  | "speaking";
type VoiceMode = "on-call" | "free" | "meeting";

interface VoicePanelProps {
  agentName: string;
  voiceWsUrl: string;
  wakeWord: string;
}

interface Transcript {
  role: "user" | "agent";
  text: string;
}

export function VoicePanel({
  agentName,
  voiceWsUrl,
  wakeWord,
}: VoicePanelProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [mode, setMode] = useState<VoiceMode>("free");
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Pré-warm cold-start ──────────────────────────────────────────────────
  // Au mount du composant, on télécharge en silence les ~15 MB d'assets VAD
  // (modèle ONNX + runtime WASM) ainsi que le module JS lui-même.
  // Sans ce pré-load, le premier clic sur "Démarrer" déclenche 3-4s de download
  // bloquant. Avec, le clic est quasi-instantané (assets déjà en cache HTTP).
  useEffect(() => {
    // Dynamic import → cache le module dans le bundler/navigateur
    import("@ricky0123/vad-web").catch(() => {});
    // Pré-fetch des assets critiques. force-cache : on accepte le cache,
    // on n'impose pas de revalidation. Ils restent dans le HTTP cache du browser.
    const assets = [
      "/vad/vad.worklet.bundle.min.js",
      "/vad/silero_vad_v5.onnx",
      "/vad/ort-wasm-simd-threaded.wasm",
    ];
    assets.forEach((url) => {
      fetch(url, { cache: "force-cache" }).catch(() => {});
    });
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vadRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Segmented audio playback ─────────────────────────────────────────────
  // Le serveur envoie l'audio par PHRASES (un audio_end par phrase) puis
  // un turn_end final. Le client maintient une queue de blobs à lire en
  // séquence. La 1ère phrase commence à jouer pendant que le LLM/TTS
  // produit les phrases suivantes en background. C'est le pattern industry
  // standard (Pipecat, LiveKit) pour TTFA <1s.
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const pendingChunksRef = useRef<ArrayBuffer[]>([]);  // chunks segment courant
  const playQueueRef = useRef<string[]>([]);            // URLs blobs prêts à jouer
  const turnEndedRef = useRef(false);                   // serveur a envoyé turn_end
  const isPlayingAudioRef = useRef(false);

  // Playback suppression : true entre l'envoi WAV utilisateur et la fin
  // complète de lecture du turn. Évite l'écho mic → boucle infernale.
  const awaitingResponseRef = useRef(false);

  const drainPlayQueue = useCallback(async () => {
    const el = audioElementRef.current;
    if (!el) return;
    // Lecture en cours : ne touche à rien, le 'ended' relancera drain.
    if (!el.paused && !el.ended && el.currentTime > 0) return;

    const next = playQueueRef.current.shift();
    if (!next) {
      // Queue vide. Si le turn est fini, on signale fin de réponse + grace.
      if (turnEndedRef.current) {
        isPlayingAudioRef.current = false;
        if (wsRef.current?.readyState === WebSocket.OPEN) setState("listening");
        // Grace 1500ms : DAC tail-out (les enceintes émettent encore après ended).
        setTimeout(() => { awaitingResponseRef.current = false; }, 1500);
      }
      return;
    }
    const oldSrc = el.src;
    el.src = next;
    try {
      await el.play();
    } catch (e) {
      console.warn("[Audio] play() blocked", e);
      isPlayingAudioRef.current = false;
      setTimeout(() => { awaitingResponseRef.current = false; }, 200);
    }
    if (oldSrc && oldSrc.startsWith("blob:")) {
      URL.revokeObjectURL(oldSrc);
    }
  }, []);

  const ensureAudioElement = useCallback(() => {
    if (audioElementRef.current) return audioElementRef.current;
    const el = new Audio();
    el.autoplay = false;
    el.preload = "auto";
    el.style.display = "none";
    document.body.appendChild(el);
    el.addEventListener("ended", () => {
      // Segment fini : essayer de jouer le suivant (ou clore le turn).
      drainPlayQueue();
    });
    el.addEventListener("error", () => {
      console.error("[Audio] element error", el.error?.message);
      setTimeout(() => { awaitingResponseRef.current = false; }, 1500);
    });
    audioElementRef.current = el;
    return el;
  }, [drainPlayQueue]);

  const stopAudioPlayback = useCallback(() => {
    pendingChunksRef.current = [];
    // Revoke tous les blobs en queue (memory leak prevention).
    playQueueRef.current.forEach((url) => {
      try { URL.revokeObjectURL(url); } catch {}
    });
    playQueueRef.current = [];
    turnEndedRef.current = false;
    const el = audioElementRef.current;
    if (el) {
      const oldSrc = el.src;
      try { el.pause(); el.removeAttribute("src"); el.load(); } catch {}
      if (oldSrc && oldSrc.startsWith("blob:")) {
        try { URL.revokeObjectURL(oldSrc); } catch {}
      }
    }
    isPlayingAudioRef.current = false;
    awaitingResponseRef.current = false;
  }, []);

  const bargeIn = useCallback(() => {
    stopAudioPlayback();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "barge_in" }));
    }
  }, [stopAudioPlayback]);

  const handleAudioChunk = useCallback((buffer: ArrayBuffer) => {
    if (!isPlayingAudioRef.current) {
      setState("speaking");
      isPlayingAudioRef.current = true;
      turnEndedRef.current = false;
    }
    pendingChunksRef.current.push(buffer);
  }, []);

  // audio_end serveur = fin d'un SEGMENT (une phrase). On finalise le blob
  // et on l'enfile dans la queue, qui se draine en arrière-plan.
  const finishSegment = useCallback(() => {
    const chunks = pendingChunksRef.current;
    pendingChunksRef.current = [];
    if (chunks.length === 0) return;
    const blob = new Blob(chunks, { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    playQueueRef.current.push(url);
    ensureAudioElement(); // s'assure que l'élément existe
    drainPlayQueue();
  }, [ensureAudioElement, drainPlayQueue]);

  // turn_end serveur = plus aucun segment ne va arriver pour ce tour.
  // Quand la queue sera vide ET la lecture finie, on clear awaitingResponse.
  const finishTurn = useCallback(() => {
    turnEndedRef.current = true;
    if (pendingChunksRef.current.length === 0 && playQueueRef.current.length === 0) {
      const el = audioElementRef.current;
      const playing = el && !el.paused && !el.ended;
      if (!playing) {
        // Serveur a clos sans aucun audio (réponse vide ou aborted).
        isPlayingAudioRef.current = false;
        setTimeout(() => { awaitingResponseRef.current = false; }, 200);
        if (wsRef.current?.readyState === WebSocket.OPEN) setState("listening");
      }
      // Sinon le 'ended' déclenchera drainPlayQueue qui appliquera la grace.
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleServerMessage = useCallback((msg: any) => {
    switch (msg.type) {
      case "listening":
        setState("listening");
        break;
      case "processing":
        setState("processing");
        break;
      case "transcript":
        setTranscripts((prev) => [
          ...prev,
          { role: msg.role === "user" ? "user" : "agent", text: msg.text || "" },
        ]);
        break;
      case "response_text":
        setTranscripts((prev) => [
          ...prev,
          { role: "agent", text: msg.text || "" },
        ]);
        break;
      case "audio_end":
        // Fin d'un SEGMENT (une phrase). D'autres segments peuvent suivre.
        finishSegment();
        break;
      case "turn_end":
        // Fin du TURN entier. Plus aucun audio ne va arriver pour ce tour.
        finishTurn();
        break;
      case "speaking":
        // Démarrage du turn de parole côté serveur.
        turnEndedRef.current = false;
        break;
      case "error":
        setErrorMsg(msg.message || "Erreur du serveur vocal");
        awaitingResponseRef.current = false;
        break;
    }
  }, [finishSegment, finishTurn]);

  const stopAll = useCallback(() => {
    if (vadRef.current) {
      try {
        vadRef.current.destroy();
      } catch {}
      vadRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    stopAudioPlayback();
  }, [stopAudioPlayback]);

  const startConversation = useCallback(async () => {
    setErrorMsg(null);
    setState("connecting");
    try {
      // Dynamic import VAD (client-side only, évite SSR)
      const vadModule = await import("@ricky0123/vad-web");

      // AEC + noise suppression + AGC obligatoires : sans ça, la voix de Léa
      // revient dans le micro (surtout sur enceintes), VAD déclenche, on coupe.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // WebSocket
      const ws = new WebSocket(voiceWsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = async () => {
        ws.send(JSON.stringify({ type: "start", mode, rate: 0 }));
        try {
          // Config VAD vad-web@0.0.30 (modèle Silero v5, paramètres en MS) :
          //   - Defaults lib v5 : pos=0.3, neg=0.25, redemption=1400ms, minSpeech=400ms, preSpeechPad=800ms
          //   - Pipecat (kwindla) : stop_secs 800ms-1s pour usages "réfléchir"
          //   - LiveKit : min_silence_duration 0.55s default, 1s+ pour conversation naturelle
          // Choix : conservateur sur thresholds (env potentiellement bruyant + enceintes),
          // pause de réflexion naturelle ~1.4s sans couper.
          const vad = await vadModule.MicVAD.new({
            getStream: async () => stream,
            baseAssetPath: "/vad/",
            onnxWASMBasePath: "/vad/",
            positiveSpeechThreshold: 0.5,   // > default 0.3 : moins de faux positifs
            negativeSpeechThreshold: 0.35,  // > default 0.25 : idem
            minSpeechMs: 300,                // capte "oui"/"non", filtre clics courts
            preSpeechPadMs: 500,             // récupère attaques de mots loupées
            redemptionMs: 1400,              // pause naturelle sans couper l'utilisateur
            onSpeechStart: () => {
              // Playback suppression : pas de barge-in pendant que Léa prépare/parle.
              if (awaitingResponseRef.current || isPlayingAudioRef.current) return;
              setState("recording");
            },
            onSpeechEnd: (audio: Float32Array) => {
              if (awaitingResponseRef.current || isPlayingAudioRef.current) return;
              awaitingResponseRef.current = true;
              const wavBuffer = float32ToWav(audio, 16000);
              if (ws.readyState === WebSocket.OPEN) ws.send(wavBuffer);
              setState("processing");
            },
          });
          await vad.start();
          vadRef.current = vad;
          setState("listening");
        } catch (e) {
          console.error("[VAD] init error", e);
          setErrorMsg(
            "Impossible de démarrer le micro (permission ? HTTPS ?)"
          );
          setState("idle");
          ws.close();
        }
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          handleAudioChunk(event.data);
        } else {
          try {
            handleServerMessage(JSON.parse(event.data));
          } catch {}
        }
      };

      ws.onclose = () => {
        stopAll();
        setState("idle");
      };

      ws.onerror = () => {
        setErrorMsg("Erreur de connexion au service vocal");
        setState("idle");
      };
    } catch (err) {
      console.error("[VoicePanel] start error", err);
      if (err instanceof Error && err.name === "NotAllowedError") {
        setErrorMsg("Micro refusé — autorisez l'accès au microphone");
      } else {
        setErrorMsg("Impossible de démarrer la conversation");
      }
      setState("idle");
    }
  }, [voiceWsUrl, mode, bargeIn, handleAudioChunk, handleServerMessage, stopAll]);

  const stopConversation = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: "stop" }));
      } catch {}
      wsRef.current.close();
    }
    wsRef.current = null;
    stopAll();
    setState("idle");
  }, [stopAll]);

  // Update mode on server quand actif
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "set_mode", mode }));
    }
  }, [mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: "stop" }));
        } catch {}
        wsRef.current.close();
      }
      wsRef.current = null;
      stopAll();
    };
  }, [stopAll]);

  const isActive = state !== "idle";
  const modes: { id: VoiceMode; label: string; Icon: typeof Phone }[] = [
    { id: "on-call", label: "Sur appel", Icon: Phone },
    { id: "free", label: "Libre", Icon: MessageCircle },
    { id: "meeting", label: "Réunion", Icon: FileText },
  ];

  return (
    <div className="flex flex-col h-full px-6 pb-4 overflow-hidden">
      {/* Mode tabs */}
      <div
        className={cn(
          "flex items-center gap-1 bg-surface-2 p-1 mt-4 mb-4 rounded-sm",
          isActive && "opacity-60 pointer-events-none"
        )}
      >
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold uppercase tracking-tight rounded-sm transition-all",
              mode === m.id
                ? "bg-accent-primary/10 text-accent-glow"
                : "text-text-muted hover:bg-surface-3/50"
            )}
          >
            <m.Icon className="w-3 h-3" />
            {m.label}
          </button>
        ))}
      </div>

      {/* Micro */}
      <div className="flex flex-col items-center justify-center py-3">
        <button
          onClick={isActive ? stopConversation : startConversation}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center transition-all border-2",
            state === "recording" &&
              "bg-red-500/15 border-red-500/50 animate-pulse",
            state === "speaking" &&
              "bg-accent-primary/15 border-accent-primary/60 animate-pulse",
            state === "listening" &&
              "bg-accent-primary/10 border-accent-primary/30",
            state === "idle" &&
              "bg-accent-primary/10 border-accent-primary/20 hover:bg-accent-primary/20",
            state === "connecting" &&
              "bg-amber-500/15 border-amber-500/50 animate-pulse",
            state === "processing" && "bg-surface-3 border-border-subtle"
          )}
          title={isActive ? "Raccrocher" : "Démarrer la conversation"}
        >
          {isActive ? (
            <Square className="w-7 h-7 text-text-primary" fill="currentColor" />
          ) : (
            <Mic className="w-8 h-8 text-accent-glow" />
          )}
        </button>
        <p className="text-xs text-text-muted mt-3 text-center px-2">
          {state === "idle" && "Cliquez pour démarrer la conversation"}
          {state === "connecting" && "Connexion au service vocal…"}
          {state === "listening" &&
            (mode === "on-call" ? `Dites « ${wakeWord} » pour lui parler` : "En écoute…")}
          {state === "recording" && "Je vous écoute…"}
          {state === "processing" && "Réflexion…"}
          {state === "speaking" && `${agentName} répond…`}
        </p>
        {errorMsg && (
          <p className="mt-2 text-[11px] text-red-500 text-center px-2">
            {errorMsg}
          </p>
        )}
      </div>

      {/* Transcripts */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
        {transcripts.length === 0 && (
          <p className="text-xs text-text-muted text-center py-6 px-4 leading-relaxed">
            Vos échanges avec {agentName} apparaîtront ici et seront sauvegardés
            dans vos conversations.
          </p>
        )}
        {transcripts.map((t, i) => (
          <div
            key={i}
            className={cn(
              "p-2.5 text-xs leading-relaxed",
              t.role === "user"
                ? "bg-accent-primary/5 border-l-2 border-l-accent-primary/40 text-text-primary"
                : "bg-surface-2 text-text-secondary"
            )}
          >
            <span className="micro-label block mb-1 text-text-muted">
              {t.role === "user" ? "Vous" : agentName}
            </span>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// Float32Array PCM 16 kHz -> WAV 16-bit (identique au helper voice-poc)
function float32ToWav(float32: Float32Array, sampleRate: number): ArrayBuffer {
  const numSamples = float32.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++)
      view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
}
