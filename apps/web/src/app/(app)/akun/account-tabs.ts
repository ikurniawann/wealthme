export const ACCOUNT_TAB_IDS = [
  "profil",
  "keamanan",
  "preferensi",
  "bantuan",
] as const;

export type AccountTabId = (typeof ACCOUNT_TAB_IDS)[number];

type AccountSubpageId =
  | "profil"
  | "keamanan"
  | "koneksi"
  | "pengaturan"
  | "notif-setting"
  | "privasi"
  | "bantuan"
  | "hubungi"
  | "tentang"
  | "family";

const SUBPAGE_TABS: Record<AccountSubpageId, AccountTabId> = {
  profil: "profil",
  keamanan: "keamanan",
  koneksi: "preferensi",
  pengaturan: "preferensi",
  "notif-setting": "preferensi",
  privasi: "preferensi",
  bantuan: "bantuan",
  hubungi: "bantuan",
  tentang: "bantuan",
  family: "preferensi",
};

export function isAccountTab(value: string | null): value is AccountTabId {
  return ACCOUNT_TAB_IDS.some((tab) => tab === value);
}

export function getInitialAccountTab(
  search: string,
  rememberedTab: string | null,
): AccountTabId {
  const fromUrl = new URLSearchParams(search).get("tab");
  if (isAccountTab(fromUrl)) return fromUrl;
  return isAccountTab(rememberedTab) ? rememberedTab : "profil";
}

export function getAccountTabForSubpage(
  subpage: AccountSubpageId,
): AccountTabId {
  return SUBPAGE_TABS[subpage];
}

const ACCOUNT_TAB_EVENT = "wealthme-account-tab-change";

function subscribeAccountTab(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(ACCOUNT_TAB_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(ACCOUNT_TAB_EVENT, onChange);
  };
}

function getAccountTabSnapshot(): AccountTabId {
  return getInitialAccountTab(
    window.location.search,
    window.localStorage.getItem("wealthme-account-tab"),
  );
}

function getServerAccountTabSnapshot(): AccountTabId {
  return "profil";
}

export function useAccountTab() {
  return useSyncExternalStore(
    subscribeAccountTab,
    getAccountTabSnapshot,
    getServerAccountTabSnapshot,
  );
}

export function notifyAccountTabChange() {
  window.dispatchEvent(new Event(ACCOUNT_TAB_EVENT));
}
import { useSyncExternalStore } from "react";
