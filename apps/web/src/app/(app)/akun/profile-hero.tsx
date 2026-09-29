import type { ReactNode } from "react";
import { User } from "lucide-react";

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
    <div className="gradient-profile grid grid-cols-[60px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-2xl p-4 text-white sm:grid-cols-[60px_minmax(0,1fr)_auto] sm:p-5">
      <div className="row-span-2 flex size-[60px] items-center justify-center rounded-full bg-white/20 text-[22px] font-extrabold">
        {initials || <User className="size-5" />}
      </div>
      <div className="min-w-0 sm:col-start-2 sm:row-start-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 break-words text-[18px] font-extrabold leading-snug">
            {displayName}
          </span>
          {role && (
            <span className="max-w-full break-words rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white">
              {role}
            </span>
          )}
        </div>
        <div className="mt-0.5 break-all text-[13px] opacity-90">{email}</div>
        <div className="mt-0.5 text-[12px] opacity-75">{memberSince}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="col-start-2 flex min-h-11 w-fit items-center gap-1.5 rounded-lg border border-white/30 bg-white/15 px-3 text-[12px] font-semibold text-white sm:col-start-3 sm:row-span-2 sm:row-start-1"
      >
        <User className="size-3.5" /> {actionLabel}
      </button>
    </div>
  );
}
