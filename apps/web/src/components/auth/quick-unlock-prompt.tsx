"use client";

import { useState } from "react";
import { Hash, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useLocale } from "@/hooks/use-locale";
import { useRegisterDevice, useSetDevicePin } from "@/hooks/use-devices";
import { writeStoredDevice } from "./device-storage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const FIELD_CLASS =
  "w-full rounded-md border-[1.5px] border-slate-200 bg-white py-2.5 px-3.5 text-center text-lg tracking-[0.4em] text-slate-900 outline-none transition-colors focus:border-primary";

/**
 * EPIC-023 D2 (US-FAM-13, D7) — "set up quick unlock" prompt, offered (not
 * forced) right after a successful password login. Registers a device
 * (`POST /auth/devices`, requires the session that JUST got established) and
 * immediately sets a PIN on it. Skipping is always available — a device that
 * never sets a PIN simply keeps using password login every time.
 */
export function QuickUnlockPrompt({
  userId,
  open,
  onOpenChange,
}: {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLocale();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const { mutateAsync: registerDevice, isPending: isRegistering } =
    useRegisterDevice();
  const { mutateAsync: setDevicePin, isPending: isSettingPin } =
    useSetDevicePin();
  const isPending = isRegistering || isSettingPin;

  function reset() {
    setPin("");
    setConfirmPin("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      toast.warning(t.deviceUnlock.toastPinLength);
      return;
    }
    if (pin !== confirmPin) {
      toast.warning(t.deviceUnlock.toastPinMismatch);
      return;
    }

    try {
      const { deviceId, deviceSecret } = await registerDevice(undefined);
      await setDevicePin({ deviceId, pin });
      writeStoredDevice(userId, { deviceId, deviceSecret });
      toast.success(t.deviceUnlock.toastSetupSuccess);
      reset();
      onOpenChange(false);
    } catch {
      toast.error(t.deviceUnlock.toastSetupFailed);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-[min(420px,calc(100%-2rem))] p-6">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <DialogTitle className="text-[17px] font-extrabold text-foreground">
            {t.deviceUnlock.promptTitle}
          </DialogTitle>
        </div>
        <p className="mb-5 text-[13px] text-muted-foreground">
          {t.deviceUnlock.promptSubtitle}
        </p>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div>
            <label
              htmlFor="quick-unlock-pin"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600"
            >
              <Hash className="size-3.5" /> {t.deviceUnlock.promptSetPinLabel}
            </label>
            <input
              id="quick-unlock-pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder={t.deviceUnlock.promptPinPlaceholder}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              placeholder={t.deviceUnlock.promptConfirmPinPlaceholder}
              className={FIELD_CLASS}
              aria-label={t.deviceUnlock.promptConfirmPinPlaceholder}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              className="flex-1 rounded-lg border py-2.5 text-[13px] font-semibold text-foreground"
            >
              {t.deviceUnlock.promptSkipButton}
            </button>
            <button
              type="submit"
              disabled={
                isPending || pin.length !== 6 || confirmPin.length !== 6
              }
              className="flex-1 rounded-lg bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {isPending
                ? t.deviceUnlock.promptSubmitting
                : t.deviceUnlock.promptSubmitButton}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
