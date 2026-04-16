"use client";

import Image from "next/image";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Session } from "next-auth";

type Props = {
  session: Session;
  open: boolean;
  onClose: () => void;
};

export default function ProfileSheet({ session, open, onClose }: Props) {
  const router = useRouter();

  function handleSignOut() {
    onClose();
    signOut({ callbackUrl: "/login" });
  }

  function handleHelp() {
    onClose();
    router.push("/help");
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sheet */}
      <div
        className={`fixed bottom-6 left-0 right-0 z-50 max-w-105 mx-auto transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-sp-surface border-t border-sp-border rounded-t-3xl px-5 pt-5 pb-10 space-y-2">
          {/* Handle */}
          <div className="w-10 h-1 rounded-full bg-sp-border mx-auto mb-6" />

          {/* User Info */}
          <div className="flex items-center gap-3 pb-4 border-b border-sp-border mb-2">
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt="profile"
                width={44}
                height={44}
                className="rounded-full border border-sp-border"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-sp-accent/10 border border-sp-accent/25 flex items-center justify-center font-barlow font-bold text-lg text-sp-accent">
                {session.user.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
            )}

            <div>
              <p className="font-barlow font-bold text-base leading-none">
                {session.user.name ?? "Athlete"}
              </p>
              <p className="text-xs text-sp-muted mt-1">{session.user.role}</p>
            </div>
          </div>

          {/* Switch Account */}
          <button
            onClick={onClose}
            className="w-full flex items-center gap-4 py-4 border-b border-sp-border"
          >
            <div className="w-9 h-9 rounded-xl bg-sp-surface2 border border-sp-border flex items-center justify-center">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-sp-muted"
              >
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <span className="text-sm font-medium text-sp-text">
              Switch Account
            </span>
          </button>

          {/* Help */}
          <button
            onClick={handleHelp}
            className="w-full flex items-center gap-4 py-4 border-b border-sp-border"
          >
            <div className="w-9 h-9 rounded-xl bg-sp-surface2 border border-sp-border flex items-center justify-center">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-sp-muted"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <span className="text-sm font-medium text-sp-text">Help</span>
          </button>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-4 py-4"
          >
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-red-400"
              >
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </div>
            <span className="text-sm font-medium text-red-400">Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );
}
