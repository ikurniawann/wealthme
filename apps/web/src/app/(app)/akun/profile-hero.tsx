import type { ReactNode } from "react";
import { User } from "lucide-react";
import { BentoHero, GhostButton } from "@/components/wm";

export function ProfileHero({
  initials,
  displayName,
  email,
  role,
  memberSince,
  actionLabel,
  onEdit,
}: {
  initials: ReactNode;
  displayName: string;
  email: string;
  role?: string;
  memberSince: string;
  actionLabel: string;
  onEdit: () => void;
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
          <span className="ak-email">{email}</span>
          {role && <span className="ak-role">{role}</span>}
          <span className="ak-since">{memberSince}</span>
        </span>
      }
      controls={
        <GhostButton lit onClick={onEdit}>
          <User className="size-3.5" aria-hidden="true" /> {actionLabel}
        </GhostButton>
      }
    />
  );
}
