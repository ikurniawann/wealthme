"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-compat";
import { isPageTitleId } from "@/lib/nav";
import { useLocale } from "@/hooks/use-locale";
import type { I18nDictionary } from "@/i18n/types";
import { registerPhoneHeaderSlot } from "./phone-header";

const DEFAULT_TITLE = "WealthMe, Personal Wealth OS";

export function greetingFor(hour: number, t: I18nDictionary): string {
  if (hour < 11) return t.shell.v2.greetingMorning;
  if (hour < 15) return t.shell.v2.greetingAfternoon;
  if (hour < 19) return t.shell.v2.greetingEvening;
  return t.shell.v2.greetingNight;
}

/** Tab/page title for a first path segment; null = no page of its own. */
function pageTitleFor(seg: string, t: I18nDictionary): string | null {
  if (seg === "menu") return t.shell.phone.menu.title;
  return isPageTitleId(seg) ? t.shell.pageTitles[seg] : null;
}

/**
 * Phone-only page head (`.wm-mtitle`). Phones (2026-10-20 references): a large
 * bold title at the top left and an optional round icon action on the right
 * (`PhoneHeaderAction`, portalled into `.wm-mtitle-act`). On Beranda the
 * greeting is the visible line and the title stays for screen readers. Above
 * 720px it stays in the DOM visually hidden, so the page title is the one
 * `h1` on every viewport and pages never render their own.
 */
export function PageGreeting() {
  const pathname = usePathname();
  const { t } = useLocale();
  const { data: session } = useSession();
  // The greeting depends on the viewer's clock, so it is filled in after mount
  // to keep the server render and hydration identical.
  const [hour, setHour] = useState<number | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHour(new Date().getHours()), []);

  const seg = pathname.split("/")[1] || "beranda";
  const docTitle = pageTitleFor(seg, t);
  const title =
    seg === "beranda" ? t.shell.v2.homeTitle : (docTitle ?? "WealthMe");
  const firstName = session?.user.name?.split(" ")[0];
  // Pages are client components, so the tab title follows the shell's page
  // title here instead of per-page `metadata` (layout.tsx owns the default).
  useEffect(() => {
    document.title = docTitle ? `${docTitle} | WealthMe` : DEFAULT_TITLE;
  }, [docTitle, pathname]);

  return (
    <div className="wm-mtitle" data-home={seg === "beranda" || undefined}>
      <div className="wm-mtitle-text">
        <small>
          {hour === null
            ? " "
            : firstName
              ? `${greetingFor(hour, t)}, ${firstName}`
              : greetingFor(hour, t)}
        </small>
        <h1>{title}</h1>
      </div>
      <div className="wm-mtitle-act" ref={registerPhoneHeaderSlot} />
    </div>
  );
}
