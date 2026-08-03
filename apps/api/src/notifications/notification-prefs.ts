import type { PrismaService } from "../prisma/prisma.service";

export const NOTIF_PREF_KEYS = [
  "txnIn",
  "txnOut",
  "txnBig",
  "budget80",
  "goalMilestone",
  "billDue",
  "stockPrice",
  "dividend",
  // EPIC-016 Task K — Keamanan & Password toggles (Notifikasi Login Baru /
  // Konfirmasi Transaksi Besar). Both default OFF: unlike the transaction
  // notification keys above, there is no push/authentication mechanism yet
  // that actually enforces these, so they must not silently read as "on".
  "loginAlert",
  "bigTxnConfirm",
] as const;

export type NotifPrefKey = (typeof NOTIF_PREF_KEYS)[number];
export type NotificationPrefs = Record<NotifPrefKey, boolean>;

// All default ON — mirrors the demo's defaultChecked toggles.
export const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  txnIn: true,
  txnOut: true,
  txnBig: true,
  budget80: true,
  goalMilestone: true,
  billDue: true,
  stockPrice: true,
  dividend: true,
  loginAlert: false,
  bigTxnConfirm: false,
};

/**
 * Merge a stored (untrusted) JSON value over the defaults, keeping ONLY known
 * keys and coercing values to boolean. Unknown keys dropped; non-boolean values
 * keep the default. Safe on null/anything.
 */
export function resolveNotifPrefs(stored: unknown): NotificationPrefs {
  const result: NotificationPrefs = { ...DEFAULT_NOTIF_PREFS };
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    for (const key of NOTIF_PREF_KEYS) {
      const value = (stored as Record<string, unknown>)[key];
      if (typeof value === "boolean") result[key] = value;
    }
  }
  return result;
}

/** Family-scoped enforcement: resolve the family OWNER's notification prefs. */
export async function ownerNotifPrefs(
  prisma: PrismaService,
  familyGroupId: string,
): Promise<NotificationPrefs> {
  const owner = await prisma.member.findFirst({
    where: { familyGroupId, role: "owner" },
    select: { user: { select: { notificationPrefs: true } } },
  });
  return resolveNotifPrefs(owner?.user?.notificationPrefs ?? null);
}
