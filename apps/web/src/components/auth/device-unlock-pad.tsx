"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import { useLocale } from "@/hooks/use-locale";
import { type StoredDevice } from "./device-storage";

const FIELD_CLASS =
  "w-full rounded-md border-[1.5px] border-slate-200 bg-white py-3 px-3.5 text-center text-2xl tracking-[0.5em] text-slate-900 outline-none transition-colors focus:border-primary";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

/**
 * EPIC-023 D2 (US-FAM-13, D7) — pre-login PIN pad. Rendered by the login
 * page instead of the password form when this device already has a stored
 * `deviceSecret`+`deviceId`. Submitting calls the Next.js
 * `/api/device-unlock` route handler (server-side, so it can install the
 * SAME httpOnly session cookie a normal password login would) — never the
 * NestJS endpoint directly from the client, since a client fetch cannot set
 * an httpOnly cookie for this origin.
 *
 * "A new device needs the password again" — the fallback is always visible
 * (`onUsePassword`), and any unlock failure never traps the user here.
 */
export function DeviceUnlockPad({
  device,
  onUnlocked,
  onUsePassword,
}: {
  device: StoredDevice;
  onUnlocked: () => void;
  onUsePassword: () => void;
}) {
  const { t } = useLocale();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length !== 6) return;
    setLoading(true);
    try {
      const res = await fetch("/api/device-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: device.deviceId,
          deviceSecret: device.deviceSecret,
          pin,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          code?: string;
          remainingMs?: number;
        };
        setPin("");
        if (
          body.code === "DEVICE_LOCKED" &&
          typeof body.remainingMs === "number"
        ) {
          toast.error(
            `${t.deviceUnlock.toastUnlockLockedPrefix}${formatRemaining(
              body.remainingMs,
            )}${t.deviceUnlock.toastUnlockLockedSuffix}`,
          );
        } else {
          toast.error(t.deviceUnlock.toastUnlockFailed);
        }
        return;
      }

      onUnlocked();
    } catch {
      setPin("");
      toast.error(t.deviceUnlock.toastUnlockFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[420px] rounded-3xl bg-white/[0.97] p-10 shadow-[0_32px_80px_rgba(0,0,0,0.3)]">
      <div className="mb-5 flex items-center justify-center gap-2.5">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-xl font-extrabold tracking-tighter text-white">
          <Lock className="size-5" />
        </div>
      </div>
      <h1 className="text-center text-[19px] font-extrabold text-slate-900">
        {t.deviceUnlock.padTitle}
      </h1>
      <p className="mb-7 text-center text-[13px] text-slate-500">
        {t.deviceUnlock.padSubtitle}
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className={FIELD_CLASS}
          aria-label={t.deviceUnlock.padTitle}
        />
        <button
          type="submit"
          disabled={loading || pin.length !== 6}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-bold text-white transition-all hover:-translate-y-px hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? t.deviceUnlock.padSubmitting
            : t.deviceUnlock.padSubmitButton}
        </button>
      </form>

      <button
        onClick={onUsePassword}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-200 bg-slate-50 py-2.5 text-[13px] font-semibold text-slate-700 transition-colors hover:border-primary hover:bg-indigo-50"
      >
        {t.deviceUnlock.padUsePasswordInstead}
      </button>
    </div>
  );
}
