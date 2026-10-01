"use client";

import { useRef, type ChangeEvent, type ReactNode } from "react";
import { Camera, Loader2, User } from "lucide-react";
import { BentoHero, GhostButton, HeroKpi } from "@/components/wm";
import { AVATAR_ACCEPT } from "@/hooks/avatar-file";

export type ProfileHeroAvatar = {
  /** `/auth/me` avatarUrl — enables "Hapus foto" when set. */
  url: string | null | undefined;
  /** The rendered face (e.g. `<AvatarPhoto>`); defaults to the initials. */
  photo?: ReactNode;
  busy: boolean;
  changeLabel: string;
  removeLabel: string;
  busyLabel: string;
  onPick: (file: File) => void;
  onRemove: () => void;
};

export function ProfileHero({
  initials,
  displayName,
  email,
  role,
  memberSince: _memberSince,
  actionLabel,
  onEdit,
  kpis,
  progress,
  avatar,
}: {
  initials: ReactNode;
  displayName: string;
  /** Identity line next to the role: a real email, `@username`, or a hint —
   * never the internal placeholder mailbox (see lib/display-email). */
  email: ReactNode;
  role?: string;
  memberSince: string;
  actionLabel: string;
  onEdit: () => void;
  /** Prototype parity (akun.html hero): Anggota keluarga / Sesi aktif / Tema. */
  kpis?: {
    familyLabel: string;
    familyValue: ReactNode;
    sessionsLabel: string;
    sessionsValue: ReactNode;
    themeLabel: string;
    themeValue: ReactNode;
  };
  /** Prototype parity (akun.html `.ak-prog`/`.ak-steps`) — "Kelengkapan
   * profil" block: a title + big percentage, then 5 segmented step bars
   * derived from real app data (never hardcoded). */
  progress?: {
    title: ReactNode;
    percentLabel: string;
    steps: { label: string; done: boolean }[];
  };
  /** Makes the avatar a "Ganti foto" picker (camera badge) when present. */
  avatar?: ProfileHeroAvatar;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const face = avatar?.photo ?? (initials || <User className="size-5" />);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
    if (file && avatar) avatar.onPick(file);
  }

  return (
    <BentoHero
      className="ak-hero"
      currency={null}
      value={
        <span className="ak-hero-name">
          {avatar ? (
            <>
              <button
                type="button"
                className="ak-avatar ak-avatar--edit"
                aria-label={avatar.busy ? avatar.busyLabel : avatar.changeLabel}
                title={avatar.changeLabel}
                aria-busy={avatar.busy || undefined}
                disabled={avatar.busy}
                onClick={() => inputRef.current?.click()}
              >
                {face}
                {avatar.busy && (
                  <span className="ak-avatar-busy" aria-hidden="true">
                    <Loader2 className="size-5 animate-spin" />
                  </span>
                )}
                <span className="ak-avatar-cam" aria-hidden="true">
                  <Camera />
                </span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept={AVATAR_ACCEPT.join(",")}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={handleFile}
              />
            </>
          ) : (
            <span className="ak-avatar" aria-hidden="true">
              {face}
            </span>
          )}
          <span className="ak-name">{displayName}</span>
        </span>
      }
      caption={
        <span className="ak-meta">
          {role && <span className="ak-role">{role}</span>}
          <span className="ak-email">{email}</span>
        </span>
      }
      controls={
        <>
          {avatar?.url && (
            <GhostButton onClick={avatar.onRemove} disabled={avatar.busy}>
              {avatar.removeLabel}
            </GhostButton>
          )}
          <GhostButton lit onClick={onEdit}>
            {actionLabel}
          </GhostButton>
        </>
      }
      chart={
        progress ? (
          <div className="ak-prog">
            <div className="ak-prog-h">
              <b>{progress.title}</b>
              <span className="ak-prog-num">{progress.percentLabel}</span>
            </div>
            <div className="ak-steps">
              {progress.steps.map((step) => (
                <div
                  key={step.label}
                  className={`ak-step${step.done ? " on" : ""}`}
                >
                  <i aria-hidden="true" />
                  <span>{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : undefined
      }
      kpis={
        kpis ? (
          <>
            <HeroKpi label={kpis.familyLabel} value={kpis.familyValue} />
            <HeroKpi label={kpis.sessionsLabel} value={kpis.sessionsValue} />
            <HeroKpi label={kpis.themeLabel} value={kpis.themeValue} />
          </>
        ) : undefined
      }
    />
  );
}
