"use client";

// V1.1.I-A — Composant upload Cloudinary réutilisable (remplace stub Builder 2).
//
// Upload via Cloudinary Unsigned Upload API (fetch direct navigateur → Cloudinary).
// Pas de SDK serveur requis. L'upload preset doit être configuré "Unsigned" dans
// la console Cloudinary (Settings > Upload > Upload presets).
//
// ENV requis (publics NEXT_PUBLIC_*) :
//   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=<cloud_name>
//   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=<preset_name>
//
// TODO V1.1.I-A.1 : créer le preset "mybotia_avatars" dans le compte Cloudinary
//   (Settings > Upload > Upload presets > Add preset, mode Unsigned,
//    dossier cible mybotia/avatars, transformations autorisées).
//
// Interface rétrocompatible avec le stub Builder 2 (kind étendu avec "image").

import { useRef, useState, useCallback, DragEvent, ChangeEvent } from "react";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/Toast";

export type CloudinaryUploadKind = "logo" | "logo_small" | "avatar" | "image";

interface CloudinaryUploadProps {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  kind?: CloudinaryUploadKind;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo

async function uploadToCloudinary(file: File): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary non configuré — vérifier NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME et NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET dans .env.local"
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "mybotia/avatars");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: "Erreur réseau" } }));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ?? `Upload HTTP ${res.status}`
    );
  }

  const data = (await res.json()) as { secure_url: string };
  return data.secure_url;
}

export function CloudinaryUpload({
  value,
  onChange,
  kind = "image",
  placeholder,
  disabled = false,
  className,
}: CloudinaryUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const isAvatar = kind === "avatar";
  const isSmall = kind === "logo_small";

  const handleFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error("Format non supporté — JPG, PNG, WEBP ou GIF uniquement.");
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        toast.error("Fichier trop lourd — 5 Mo maximum.");
        return;
      }

      setLoading(true);
      try {
        const url = await uploadToCloudinary(file);
        onChange(url);
        toast.success("Image uploadée avec succès.");
      } catch (e) {
        console.error("[CloudinaryUpload] upload error", e);
        toast.error(e instanceof Error ? e.message : "Échec de l'upload — réessayez.");
      } finally {
        setLoading(false);
      }
    },
    [onChange]
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled || loading) return;
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [disabled, loading, handleFile]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleRemove = useCallback(() => onChange(null), [onChange]);

  const triggerOpen = () => !disabled && !loading && inputRef.current?.click();

  const previewDim = isAvatar ? 80 : isSmall ? 40 : 96;

  return (
    <div className={cn("flex items-start gap-4", className)}>
      {/* Zone preview / drop */}
      <div
        onClick={triggerOpen}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") triggerOpen(); }}
        aria-label={value ? "Changer l'image" : "Uploader une image"}
        className={cn(
          "relative shrink-0 border-2 border-dashed transition-colors cursor-pointer select-none overflow-hidden",
          isAvatar ? "rounded-full" : "rounded-sm",
          dragOver
            ? "border-accent-primary bg-accent-primary/10"
            : value
            ? "border-transparent"
            : "border-surface-3 hover:border-accent-primary/50 bg-surface-2",
          disabled && "cursor-not-allowed opacity-50",
          !value && "flex items-center justify-center"
        )}
        style={{ width: previewDim, height: previewDim }}
      >
        {loading ? (
          <div className={cn("flex items-center justify-center bg-black/40 absolute inset-0", isAvatar ? "rounded-full" : "rounded-sm")}>
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        ) : value ? (
          <Image
            src={value}
            alt="Aperçu"
            width={previewDim}
            height={previewDim}
            className={cn("object-cover w-full h-full", isAvatar ? "rounded-full" : "rounded-sm")}
            unoptimized
          />
        ) : (
          <Upload className="w-5 h-5 text-text-muted" />
        )}

        {/* Overlay "changer" au hover */}
        {value && !loading && !disabled && (
          <div className={cn("absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center group", isAvatar ? "rounded-full" : "rounded-sm")}>
            <Upload className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        disabled={disabled || loading}
        onChange={handleInputChange}
        aria-hidden="true"
      />

      {/* Méta + supprimer */}
      <div className="flex flex-col gap-1.5 justify-center">
        <p className="text-xs text-text-muted leading-snug">
          {placeholder ??
            (isAvatar
              ? "Photo de profil"
              : kind === "logo"
              ? "Logo société (512×512 recommandé)"
              : kind === "logo_small"
              ? "Favicon / logo réduit"
              : "Image")}
        </p>
        <p className="text-[11px] text-text-muted/60">JPG, PNG, WEBP — max 5 Mo</p>
        {value && !disabled && (
          <button
            type="button"
            onClick={handleRemove}
            className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 transition-colors w-fit"
          >
            <X className="w-3 h-3" />
            Supprimer
          </button>
        )}
        {(!CLOUD_NAME || !UPLOAD_PRESET) && (
          <p className="text-[10px] text-amber-300 font-mono">
            [Cloudinary non configuré — voir .env.local]
          </p>
        )}
      </div>
    </div>
  );
}
