import type { ReactNode } from "react";
import { User } from "lucide-react";
import { BentoHero, GhostButton, HeroKpi } from "@/components/wm";

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
}: {
  initials: ReactNode;
  displayName: string;
  email: string;
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
}) {
  return (
    <BentoHero
      className="ak-hero"
      currency={null}
      value={
        <span className="ak-hero-name">
          <span className="ak-avatar" aria-hidden="true">
            {initials || <User className="size-5" />}
          </span>
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
        <GhostButton lit onClick={onEdit}>
          {actionLabel}
        </GhostButton>
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
