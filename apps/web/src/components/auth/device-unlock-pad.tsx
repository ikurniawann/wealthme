"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import { useLocale } from "@/hooks/use-locale";
import { type StoredDevice } from "./device-storage";

const PIN_LENGTH = 6;
const PAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const PAD_BUTTON_CLASS =
  "rounded-md border-[1.5px] border-slate-200 bg-white py-3.5 text-lg font-bold text-slate-900 transition-colors hover:border-primary hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50";
const PAD_GHOST_BUTTON_CLASS =
  "rounded-md bg-transparent py-3.5 text-sm font-semibold text-slate-500 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";

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
        } else if (res.status === 401) {
          // apps/api/src/devices/devices.service.ts only throws 401 for an
          // actually-wrong PIN/secret — this is the ONE status that means
          // "PIN salah".
          toast.error(t.deviceUnlock.toastUnlockFailed);
        } else {
          // EPIC-024 B2 (root cause) — every other failure (404 when the
          // nginx allowlist doesn't route /api/device-unlock, 5xx, or an
          // unexpected status) is a routing/server problem, NOT a wrong PIN.
          // Showing "PIN salah" here is exactly the bug this task fixes.
          toast.error(t.deviceUnlock.toastUnlockServiceUnavailable);
        }
        return;
      }

      onUnlocked();
    } catch {
      // `fetch` itself threw (offline, DNS failure, connection refused) —
      // never reached a response at all, so this is definitely not a wrong
      // PIN either.
      setPin("");
      toast.error(t.deviceUnlock.toastUnlockNetworkError);
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
        {/* EPIC-025 N3-H1 — the real, keyboard-typeable PIN field stays for
            accessibility (tab + type still works) but is visually replaced
            by the dot readout + keypad below, matching the prototype's
            keypad-only presentation. Same `pin` state, same submit logic. */}
        <input
          type="password"
          inputMode="numeric"
          maxLength={PIN_LENGTH}
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="sr-only"
          aria-label={t.deviceUnlock.padTitle}
        />

        <div
          className="flex justify-center gap-3"
          aria-hidden="true"
          data-testid="pin-dots"
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={`size-3 rounded-full border-[1.5px] transition-colors ${
                i < pin.length
                  ? "border-primary bg-primary"
                  : "border-slate-300 bg-transparent"
              }`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {PAD_DIGITS.map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={loading}
              onClick={() =>
                setPin((p) => (p.length >= PIN_LENGTH ? p : p + digit))
              }
              className={PAD_BUTTON_CLASS}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={loading}
            aria-label="Bersihkan"
            onClick={() => setPin("")}
            className={PAD_GHOST_BUTTON_CLASS}
          >
            C
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              setPin((p) => (p.length >= PIN_LENGTH ? p : p + "0"))
            }
            className={PAD_BUTTON_CLASS}
          >
            0
          </button>
          <button
            type="button"
            disabled={loading}
            aria-label="Hapus satu digit"
            onClick={() => setPin((p) => p.slice(0, -1))}
            className={PAD_GHOST_BUTTON_CLASS}
          >
            ⌫
          </button>
        </div>

        <button
          type="submit"
          disabled={loading || pin.length !== PIN_LENGTH}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-bold text-white transition-all hover:-translate-y-px hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? t.deviceUnlock.padSubmitting
            : t.deviceUnlock.padSubmitButton}
        </button>
      </form>

      <button
        onClick={onUsePassword}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-200 bg-slate-50 py-2.5 text-[13px] font-semibold text-slate-700 transition-colors hover:border-primary hover:bg-accent"
      >
        {t.deviceUnlock.padUsePasswordInstead}
      </button>
    </div>
  );
}
