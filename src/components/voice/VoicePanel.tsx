"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
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
  agentAvatar: string | null;
  voiceWsUrl: string;
  wakeWord: string;
}

interface Transcript {
  role: "user" | "agent";
  text: string;
}

export function VoicePanel({
  agentName,
  agentAvatar,
  voiceWsUrl,
  wakeWord,
}: VoicePanelProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [mode, setMode] = useState<VoiceMode>("free");
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vadRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingAudioRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const stopAudioPlayback = useCallback(() => {
    audioQueueRef.current = [];
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch {}
      currentSourceRef.current = null;
    }
    isPlayingAudioRef.current = false;
  }, []);

  const bargeIn = useCallback(() => {
    stopAudioPlayback();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "barge_in" }));
    }
  }, [stopAudioPlayback]);

  const playNextChunk = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingAudioRef.current = false;
      if (wsRef.current?.readyState === WebSocket.OPEN) setState("listening");
      return;
    }
    isPlayingAudioRef.current = true;
    if (!audioContextRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AC();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    const buf = audioQueueRef.current.shift()!;
    try {
      const audioBuffer = await audioContextRef.current.decodeAudioData(
        buf.slice(0)
      );
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      currentSourceRef.current = source;
      source.onended = () => {
        currentSourceRef.current = null;
        playNextChunk();
      };
      source.start();
    } catch {
      currentSourceRef.current = null;
      playNextChunk();
    }
  }, []);

  const handleAudioChunk = useCallback(
    (buffer: ArrayBuffer) => {
      setState("speaking");
      audioQueueRef.current.push(buffer);
      if (!isPlayingAudioRef.current) playNextChunk();
    },
    [playNextChunk]
  );

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
      case "error":
        setErrorMsg(msg.message || "Erreur du serveur vocal");
        break;
    }
  }, []);

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

      // Micro permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // WebSocket
      const ws = new WebSocket(voiceWsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = async () => {
        ws.send(JSON.stringify({ type: "start", mode, rate: 0 }));
        try {
          const vad = await vadModule.MicVAD.new({
            getStream: async () => stream,
            baseAssetPath: "/vad/",
            onnxWASMBasePath: "/vad/",
            onSpeechStart: () => {
              if (isPlayingAudioRef.current) bargeIn();
              setState("recording");
            },
            onSpeechEnd: (audio: Float32Array) => {
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
      {/* Avatar + nom */}
      <div className="pt-2 pb-4 flex flex-col items-center text-center">
        {agentAvatar ? (
          <div className="w-20 h-20 rounded-full bg-accent-primary/10 flex items-center justify-center border border-accent-primary/20 overflow-hidden mb-3">
            <Image
              src={agentAvatar}
              alt={agentName}
              width={80}
              height={80}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-accent-primary/10 flex items-center justify-center border border-accent-primary/20 mb-3">
            <span className="text-xl font-bold text-accent-glow">
              {agentName.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <h3 className="text-sm font-bold text-text-primary font-headline">
          {agentName}
        </h3>
        <p className="micro-label text-text-muted mt-0.5">Collaborateur IA</p>
      </div>

      {/* Mode tabs */}
      <div
        className={cn(
          "flex items-center gap-1 bg-surface-2 p-1 mb-4 rounded-sm",
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
