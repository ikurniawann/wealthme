"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useSession } from "@/lib/auth-compat";

/** Two-letter initials from a display name, matching the prototype avatar. */
function initialsOf(name: string | undefined): string {
  if (!name) return "?";
  return (
    name
      .split(" ")
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/**
 * EPIC-026 shell migration — prototype `.sidebar__footer` / `.sidebar__user`.
 * The collapsed rail hides `.sidebar__user > span:not(.avatar)` and
 * `.sidebar__user > i`, so the text block and the chevron are wrapped in
 * exactly those elements rather than being conditionally rendered.
 */
export function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session } = useSession();
  const name = session?.user.name;
  const email = session?.user.email;

  return (
    <div className="sidebar__footer">
      <Link
        href="/akun"
        onClick={onNavigate}
        title={name ?? undefined}
        className="sidebar__user"
      >
        <span className="avatar" aria-hidden="true">
          {initialsOf(name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="t-md t-bold block truncate">{name ?? "—"}</span>
          <span className="t-xs t-muted block truncate">{email ?? "—"}</span>
        </span>
        <i>
          <ChevronRight className="size-[15px]" aria-hidden="true" />
        </i>
      </Link>
    </div>
  );
}
