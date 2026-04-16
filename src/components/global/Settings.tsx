"use client";
import { Session } from "next-auth";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Navbar from "@/components/global/Navbar";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import ProfileSheet from "@/components/global/ProfileSheet";
import EditProfileModal from "@/components/global/Editprofilemodal";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useTheme } from "next-themes";

type SettingRowProps = {
  label: string;
  value?: string;
  variant?: string;
  rightEl?: React.ReactNode;
  onClick?: () => void;
};

function ChevronRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-sp-muted"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function SettingRow({
  label,
  value,
  variant = "default",
  rightEl,
  onClick,
}: SettingRowProps) {
  return (
    <div
      onClick={onClick}
      className={`w-full flex items-center justify-between py-3.5 border-b border-sp-border last:border-none text-left ${onClick ? "cursor-pointer" : ""}`}
    >
      <span
        className={`text-sm font-medium ${
          variant === "danger" ? "text-red-400" : "text-sp-text"
        }`}
      >
        {label}
      </span>
      <div className="flex items-center gap-2">
        {value && <span className="text-sm text-sp-muted">{value}</span>}
        {rightEl ?? <ChevronRight />}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-widest text-sp-muted mb-3 px-1">
        {title}
      </p>
      <div className="bg-sp-surface border border-sp-border rounded-2xl px-4">
        {children}
      </div>
    </div>
  );
}

type Props = {
  session: Session;
  currentLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
};

function Settings({ session, currentLevel }: Props) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const { setTheme, resolvedTheme } = useTheme();
  const mounted = resolvedTheme !== undefined;

  const tier = (session.user as { tier?: string }).tier ?? "free";
  const isPro = tier === "pro";

  function handleSignOut() {
    signOut({ callbackUrl: "/login" });
  }

  async function handleSaveProfile(data: {
    name: string;
    trainingLevel: string;
    photo: File | null;
  }) {
    const formData = new FormData();
    formData.append("name", data.name);
    if (data.photo) formData.append("photo", data.photo);

    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      body: formData,
    });

    const payload = await res.json();

    if (!res.ok) {
      console.error("[handleSaveProfile] API error:", res.status, payload);
      throw new Error(payload.error ?? "Failed to save profile");
    }

    const { user } = payload;
    await updateSession({ name: user.name, image: user.image });
    router.refresh();
  }

  return (
    <>
      <div className="min-h-screen bg-sp-bg text-sp-text font-dm pb-28 px-5 pt-6 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <p className="text-[11px] tracking-widest text-sp-muted uppercase">
            Account
          </p>
          <h1 className="font-barlow font-extrabold text-[38px] leading-none tracking-tight">
            Settings
          </h1>
        </div>

        {/* Profile card */}
        <div className="bg-sp-surface border border-sp-border rounded-2xl p-4 flex items-center gap-4">
          <button onClick={() => setProfileSheetOpen(true)}>
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt="profile"
                width={56}
                height={56}
                className="rounded-full border border-sp-border shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-sp-accent/10 border border-sp-accent/25 flex items-center justify-center font-barlow font-bold text-xl text-sp-accent shrink-0">
                {session.user.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
            )}
          </button>

          <ProfileSheet
            session={session}
            open={profileSheetOpen}
            onClose={() => setProfileSheetOpen(false)}
          />

          <div className="flex-1 min-w-0">
            <p className="font-barlow font-bold text-xl leading-none">
              {session.user.name ?? "Athlete"}
            </p>
            <p className="text-sm text-sp-muted mt-1">
              {(session.user as { role?: string }).role ?? "Athlete"}
            </p>
          </div>

          <span
            className={`text-[10px] font-medium rounded-lg px-2.5 py-1 shrink-0 border ${
              isPro
                ? "bg-yellow-400/10 border-yellow-400/30 text-yellow-400"
                : "bg-sp-accent/10 border-sp-accent/25 text-sp-accent"
            }`}
          >
            {isPro ? "Pro" : "Free Tier"}
          </span>
        </div>

        {/* Account */}
        <SectionCard title="Account">
          <SettingRow
            label="Edit Profile"
            onClick={() => setEditModalOpen(true)}
          />
        </SectionCard>

        {/* Preferences */}
        <SectionCard title="Preferences">
          <SettingRow
            label="Push Notifications"
            rightEl={
              <div className="w-10 h-6 rounded-full flex items-center px-1 bg-sp-surface2">
                <div className="w-4 h-4 rounded-full bg-sp-muted translate-x-0" />
              </div>
            }
          />
          <SettingRow
            label="Dark Mode"
            rightEl={
              mounted ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTheme(resolvedTheme === "dark" ? "light" : "dark");
                  }}
                  className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors ${
                    resolvedTheme === "dark" ? "bg-sp-accent" : "bg-sp-surface2"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full transition-transform ${
                      resolvedTheme === "dark"
                        ? "bg-sp-bg translate-x-4"
                        : "bg-sp-muted translate-x-0"
                    }`}
                  />
                </button>
              ) : (
                <div className="w-10 h-6 rounded-full bg-sp-surface2" />
              )
            }
          />
        </SectionCard>

        {/* Subscription */}
        <SectionCard title="Subscription">
          <SettingRow
            label="Current Plan"
            value={isPro ? "Pro" : "Free Tier"}
            rightEl={<span />}
          />
          {isPro ? (
            <SettingRow
              label="Manage Subscription"
              onClick={() => router.push("/settings/subscription")}
            />
          ) : (
            <div className="py-3.5">
              <Button
                onClick={() => router.push("/pricing")}
                className="w-full bg-sp-accent text-sp-bg font-barlow font-bold text-base tracking-wide uppercase rounded-xl py-3 transition-opacity hover:opacity-85"
              >
                Upgrade to Pro
              </Button>
            </div>
          )}
        </SectionCard>

        {/* More */}
        <SectionCard title="More">
          <Link href="/about">
            <SettingRow label="About Us" />
          </Link>
          <Link href="/privacy">
            <SettingRow label="Privacy Policy" />
          </Link>
          <Link href="/terms">
            <SettingRow label="Terms & Conditions" />
          </Link>
        </SectionCard>

        {/* Danger Zone */}
        <SectionCard title="Danger Zone">
          <SettingRow
            label="Sign Out"
            variant="danger"
            onClick={handleSignOut}
            rightEl={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-red-400"
              >
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            }
          />
        </SectionCard>
      </div>

      <Navbar />

      <EditProfileModal
        session={session}
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        currentLevel={currentLevel}
        onSave={handleSaveProfile}
      />
    </>
  );
}

export default Settings;
