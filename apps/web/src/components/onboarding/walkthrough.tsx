"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useShell } from "@/components/shell/shell-context";
import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { isOnboarded, setOnboarded } from "./use-onboarded";
import { clearSetupProgress, getSetupProgress } from "./setup-progress";
import { GuidedSetup } from "./guided-setup";

// EPIC-023 Task H3 (D22, US-DASH-7) — replaces the old button-spotlight tour
// (previously `components/onboarding/tour-steps.ts`, deleted) with a guided
// FIRST SETUP: this component still owns the one-time "welcome"/"resume"
// prompt, but the actual walkthrough is now `<GuidedSetup>`, which creates a
// real account, budget, and transaction instead of pointing at buttons.

type WelcomeView = "none" | "welcome" | "resume";

export function Walkthrough() {
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();
  const { data: session } = useSession();
  const userId = session?.userId ?? "";
  const { tourOpen, startTour, endTour } = useShell();

  const [welcomeView, setWelcomeView] = useState<WelcomeView>("none");
  const tr = t.onboarding;

  // Resolve only after mount (localStorage is client-only) — avoids a
  // hydration mismatch. Scoped per userId: a browser that already
  // dismissed onboarding for one account must still show it to the next
  // account that signs in on that same device.
  useEffect(() => {
    if (!userId) return;
    if (isOnboarded(userId)) return;
    const progress = getSetupProgress(userId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWelcomeView(progress && progress.step !== "done" ? "resume" : "welcome");
  }, [userId]);

  // Debug/QA shortcut — replay the welcome dialog on demand without
  // clearing localStorage. Triple-modifier combo (unlike the Cmd/Ctrl+K
  // search shortcut) so it isn't intercepted by browser chrome the way
  // plain Ctrl/Cmd+Shift+<letter> often is.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.altKey &&
        e.key.toLowerCase() === "o"
      ) {
        e.preventDefault();
        setWelcomeView("welcome");
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function dismissAsSkip() {
    setOnboarded(userId);
    setWelcomeView("none");
  }

  if (welcomeView === "welcome") {
    return (
      <>
        <Dialog open onOpenChange={(open) => !open && dismissAsSkip()}>
          <DialogContent className="min-[769px]:w-[min(420px,calc(100%-2rem))]">
            <DialogTitle className="sr-only">{tr.welcomeTitle}</DialogTitle>
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element -- fixed small brand mark, no responsive srcset needed */}
                <img
                  src="/brand/wealthme-mark.png"
                  alt=""
                  className="size-full object-contain"
                />
              </div>
              <h2 className="text-[19px] font-extrabold">{tr.welcomeTitle}</h2>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                {tr.welcomeBody}
              </p>
            </div>

            <div className="mt-5 flex items-center justify-center gap-1 rounded-lg border bg-secondary p-1">
              {/* EPIC-023 Task H fix round (MEDIUM 11) — the ID/EN buttons
                  previously differed only by background/shadow styling, no
                  ARIA state, so the selected language wasn't programmatically
                  exposed (WCAG 4.1.2) and was distinguished by colour alone
                  (WCAG 1.4.1). `aria-pressed` gives AT users the same toggle
                  state sighted users already see. */}
              <button
                type="button"
                onClick={() => setLocale("id")}
                aria-pressed={locale === "id"}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-[12.5px] font-semibold transition-colors",
                  locale === "id"
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {/* EPIC-022 Group G (G3) — text label instead of a flag
                    emoji: 🇮🇩/🇬🇧 render as tofu boxes on systems without an
                    emoji-flag font, so this stays legible everywhere. */}
                <span className="mr-1 font-black tracking-tight">ID</span>
                Bahasa Indonesia
              </button>
              <button
                type="button"
                onClick={() => setLocale("en")}
                aria-pressed={locale === "en"}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-[12.5px] font-semibold transition-colors",
                  locale === "en"
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                <span className="mr-1 font-black tracking-tight">EN</span>
                English
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setWelcomeView("none");
                  startTour();
                }}
                className="w-full rounded-md bg-primary py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-strong"
              >
                {tr.startSetupButton}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOnboarded(userId);
                  setWelcomeView("none");
                  router.push("/panduan");
                }}
                className="w-full rounded-md border py-2.5 text-[13.5px] font-semibold transition-colors hover:bg-accent"
              >
                {tr.exploreAllButton}
              </button>
              <button
                type="button"
                onClick={dismissAsSkip}
                className="w-full py-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
              >
                {tr.skipButton}
              </button>
            </div>
          </DialogContent>
        </Dialog>
        <GuidedSetup open={tourOpen} onClose={endTour} />
      </>
    );
  }

  if (welcomeView === "resume") {
    return (
      <>
        <Dialog open onOpenChange={(open) => !open && dismissAsSkip()}>
          <DialogContent className="min-[769px]:w-[min(420px,calc(100%-2rem))]">
            <DialogTitle className="text-[17px] font-extrabold">
              {tr.resumeTitle}
            </DialogTitle>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {tr.resumeBody}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setWelcomeView("none");
                  startTour();
                }}
                className="w-full rounded-md bg-primary py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-strong"
              >
                {tr.resumeContinueButton}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearSetupProgress(userId);
                  setWelcomeView("none");
                  startTour();
                }}
                className="w-full rounded-md border py-2.5 text-[13.5px] font-semibold transition-colors hover:bg-accent"
              >
                {tr.resumeRestartButton}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearSetupProgress(userId);
                  dismissAsSkip();
                }}
                className="w-full py-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
              >
                {tr.resumeSkipButton}
              </button>
            </div>
          </DialogContent>
        </Dialog>
        <GuidedSetup open={tourOpen} onClose={endTour} />
      </>
    );
  }

  return <GuidedSetup open={tourOpen} onClose={endTour} />;
}
