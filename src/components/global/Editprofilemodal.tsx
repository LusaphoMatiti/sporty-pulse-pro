"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { Session } from "next-auth";

const TRAINING_LEVELS = [
  { value: "BEGINNER", label: "Beginner", sub: "0 – 1 year" },
  { value: "INTERMEDIATE", label: "Intermediate", sub: "1 – 3 years" },
  { value: "ADVANCED", label: "Advanced", sub: "3 – 6 years" },
];

type EditProfileModalProps = {
  session: Session;
  open: boolean;
  onClose: () => void;
  currentLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  onSave?: (data: {
    name: string;
    trainingLevel: string;
    photo: File | null;
  }) => Promise<void>;
};

function CameraIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function EditProfileModal({
  session,
  open,
  onClose,
  currentLevel,
  onSave,
}: EditProfileModalProps) {
  const [name, setName] = useState(session.user.name ?? "");
  const [trainingLevel, setTrainingLevel] = useState<
    "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
  >(currentLevel);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // 1. Save profile (name + photo)
      await onSave?.({ name, trainingLevel, photo: photoFile });

      // 2. Save training level to PlanInstance
      const levelRes = await fetch("/api/user/level", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: trainingLevel }),
      });
      if (!levelRes.ok) {
        const data = await levelRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update training level");
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const avatarSrc = photoPreview ?? session.user.image ?? null;
  const initials = name.charAt(0).toUpperCase() || "?";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-x-4 z-50 bg-sp-surface border border-sp-border rounded-3xl p-6 shadow-2xl max-w-sm mx-auto"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 96px)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-sp-muted">
              Account
            </p>
            <h2 className="font-barlow font-extrabold text-2xl leading-none tracking-tight text-sp-text">
              Edit Profile
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-sp-surface2 border border-sp-border flex items-center justify-center text-sp-muted hover:text-sp-text transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* Photo */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt="profile"
                width={88}
                height={88}
                className="rounded-full border-2 border-sp-border object-cover w-22 h-22"
              />
            ) : (
              <div className="w-22 h-22 rounded-full bg-sp-accent/10 border-2 border-sp-accent/30 flex items-center justify-center font-barlow font-bold text-3xl text-sp-accent">
                {initials}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-sp-accent text-sp-bg flex items-center justify-center shadow-lg hover:opacity-85 transition-opacity"
            >
              <CameraIcon />
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-3 text-xs text-sp-accent font-medium tracking-wide hover:opacity-75 transition-opacity"
          >
            Change photo
          </button>
        </div>

        {/* Display name */}
        <div className="mb-5">
          <label className="block text-[10px] uppercase tracking-widest text-sp-muted mb-2 px-1">
            Display Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full bg-sp-bg border border-sp-border rounded-xl px-4 py-3 text-sm text-sp-text placeholder:text-sp-muted focus:outline-none focus:border-sp-accent transition-colors font-dm"
          />
        </div>

        {/* Training level */}
        <div className="mb-7">
          <label className="block text-[10px] uppercase tracking-widest text-sp-muted mb-2 px-1">
            Training Level
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TRAINING_LEVELS.map((level) => {
              const selected = trainingLevel === level.value;
              return (
                <button
                  key={level.value}
                  onClick={() =>
                    setTrainingLevel(
                      level.value as "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
                    )
                  }
                  className={`rounded-xl border px-3 py-3 text-left transition-all ${
                    selected
                      ? "bg-sp-accent/10 border-sp-accent/50 text-sp-text"
                      : "bg-sp-bg border-sp-border text-sp-muted hover:border-sp-accent/30"
                  }`}
                >
                  <p
                    className={`text-sm font-barlow font-bold ${selected ? "text-sp-accent" : ""}`}
                  >
                    {level.label}
                  </p>
                  <p className="text-[11px] text-sp-muted mt-0.5">
                    {level.sub}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-center text-[12px] text-red-400 mb-3">{error}</p>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="w-full bg-sp-accent text-sp-bg font-barlow font-bold text-base tracking-wide uppercase rounded-xl py-3.5 transition-opacity hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </>
  );
}
