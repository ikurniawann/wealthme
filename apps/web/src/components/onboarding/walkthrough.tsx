"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useShell } from "@/components/shell/shell-context";
import { useSession } from "@/lib/auth-compat";
import { useLocale } from "@/hooks/use-locale";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { isOnboarded, setOnboarded } from "./use-onboarded";
import { TOUR_STEPS } from "./tour-steps";

type Rect = { top: number; left: number; width: number; height: number };

const POLL_INTERVAL_MS = 50;
const POLL_TIMEOUT_MS = 2000;
const SPOTLIGHT_PADDING = 8;
const CARD_GAP = 14;
const CARD_WIDTH = 320;

function readRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function waitForElement(selector: string): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLElement>(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el || Date.now() - started > POLL_TIMEOUT_MS) {
        clearInterval(timer);
        resolve(el);
      }
    }, POLL_INTERVAL_MS);
  });
}

function cardPositionStyle(rect: Rect | null): CSSProperties {
  if (typeof window === "undefined" || !rect) {
    return { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardWidth = Math.min(CARD_WIDTH, vw - 32);
  let left = rect.left + rect.width / 2 - cardWidth / 2;
  left = Math.max(16, Math.min(left, vw - cardWidth - 16));

  const spaceBelow = vh - (rect.top + rect.height);
  const spaceAbove = rect.top;
  const preferBelow = spaceBelow >= 200 || spaceBelow >= spaceAbove;

  if (preferBelow) {
    return { top: rect.top + rect.height + SPOTLIGHT_PADDING + CARD_GAP, left };
  }
  return {
    top: Math.max(16, rect.top - SPOTLIGHT_PADDING - CARD_GAP - 220),
    left,
  };
}

export function Walkthrough() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, setLocale } = useLocale();
  const { data: session } = useSession();
  const userId = session?.userId ?? "";
  const { tourOpen, tourStep, startTour, nextTourStep, prevTourStep, endTour } =
    useShell();

  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const cancelledRef = useRef(false);

  // Resolve the onboarded flag only after mount; the modal stays closed
  // during SSR to avoid a hydration mismatch (localStorage is client-only).
  // Scoped per userId — a browser that already dismissed the tour for one
  // account must still show it to the next account on the same device.
  useEffect(() => {
    if (!userId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isOnboarded(userId)) setWelcomeOpen(true);
  }, [userId]);

  // Debug/QA shortcut — replay the welcome dialog on demand without
  // clearing localStorage or re-registering. Triple-modifier combo (unlike
  // the Cmd/Ctrl+K search shortcut) so it isn't intercepted by the browser
  // chrome the way plain Ctrl/Cmd+Shift+<letter> often is.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.altKey &&
        e.key.toLowerCase() === "o"
      ) {
        e.preventDefault();
        setWelcomeOpen(true);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const step = TOUR_STEPS[tourStep];
  const isLastStep = tourStep === TOUR_STEPS.length - 1;

  const finishOnboarding = useCallback(() => {
    setOnboarded(userId);
    endTour();
  }, [endTour, userId]);

  const handleNext = useCallback(() => {
    if (isLastStep) finishOnboarding();
    else nextTourStep();
  }, [isLastStep, finishOnboarding, nextTourStep]);

  // Locate (and navigate to) the current step's target whenever the tour is
  // open and the step changes — syncs local state from live DOM layout
  // (getBoundingClientRect), which can only be read after mount/navigation.
  useEffect(() => {
    if (!tourOpen || !step) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRect(null);
      return;
    }
    cancelledRef.current = false;

    async function locate() {
      if (step.route && step.route !== pathname) {
        router.push(step.route);
      }
      if (!step.target) {
        setRect(null);
        return;
      }
      const el = await waitForElement(step.target);
      if (cancelledRef.current || !el) return;
      setRect(readRect(el));
    }
    void locate();

    function reposition() {
      if (!step.target) return;
      const el = document.querySelector<HTMLElement>(step.target);
      if (el) setRect(readRect(el));
    }
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      cancelledRef.current = true;
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
    // route/target navigation is driven by the step, not reactive to pathname
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourOpen, tourStep]);

  if (welcomeOpen) {
    return (
      <Dialog open onOpenChange={(open) => !open && finishOnboarding()}>
        <DialogContent className="max-w-[420px] p-6 sm:max-w-[420px]">
          <DialogTitle className="sr-only">
            Selamat datang di WealthMe
          </DialogTitle>
          <div className="text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-2xl font-extrabold text-white">
              W
            </div>
            <h2 className="text-[19px] font-extrabold">
              Selamat datang di WealthMe 👋
            </h2>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              Aplikasi keuangan keluarga — catat, rencanakan, dan pantau
              kekayaanmu dalam satu tempat.
            </p>
          </div>

          <div className="mt-5 flex items-center justify-center gap-1 rounded-lg border bg-secondary p-1">
            <button
              type="button"
              onClick={() => setLocale("id")}
              className={cn(
                "flex-1 rounded-md py-1.5 text-[12.5px] font-semibold transition-colors",
                locale === "id"
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              🇮🇩 Bahasa Indonesia
            </button>
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={cn(
                "flex-1 rounded-md py-1.5 text-[12.5px] font-semibold transition-colors",
                locale === "en"
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              🇬🇧 English
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setWelcomeOpen(false);
                startTour();
              }}
              className="w-full rounded-md bg-primary py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-primary-strong"
            >
              Mulai Tur Lengkap (~3 menit)
            </button>
            <button
              type="button"
              onClick={() => {
                setOnboarded(userId);
                setWelcomeOpen(false);
                router.push("/panduan");
              }}
              className="w-full rounded-md border py-2.5 text-[13.5px] font-semibold transition-colors hover:bg-accent"
            >
              Jelajahi Semua Fitur
            </button>
            <button
              type="button"
              onClick={() => {
                setWelcomeOpen(false);
                finishOnboarding();
              }}
              className="w-full py-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
            >
              Lewati
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!tourOpen || !step) return null;

  const Icon = step.icon;

  return (
    <>
      {/* Click-blocking scrim — keeps the tour keyboard/button-driven */}
      <div className="fixed inset-0 z-[100]" aria-hidden="true" />

      {rect ? (
        <div
          className="pointer-events-none fixed z-[101] rounded-xl transition-[top,left,width,height] duration-300 motion-reduce:transition-none"
          style={{
            top: rect.top - SPOTLIGHT_PADDING,
            left: rect.left - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: rect.height + SPOTLIGHT_PADDING * 2,
            boxShadow: "0 0 0 9999px rgba(15,23,42,0.65)",
          }}
        />
      ) : (
        <div
          className="pointer-events-none fixed inset-0 z-[101]"
          style={{ boxShadow: "0 0 0 9999px rgba(15,23,42,0.65)" }}
        />
      )}

      <div
        className="fixed z-[102] w-[calc(100%-2rem)] max-w-[320px] rounded-2xl border bg-card p-5 shadow-2xl transition-[top,left] duration-300 motion-reduce:transition-none"
        style={cardPositionStyle(rect)}
      >
        <button
          type="button"
          onClick={finishOnboarding}
          aria-label="Lewati tur"
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="mb-3 flex size-10 items-center justify-center rounded-[10px] bg-accent text-primary">
          <Icon className="size-5" />
        </div>
        <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
          Langkah {tourStep + 1} dari {TOUR_STEPS.length}
        </div>
        <h3 className="text-[15px] font-extrabold">{step.title}</h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
          {step.body}
        </p>

        {step.directAction && step.target ? (
          <button
            type="button"
            onClick={() => {
              // Same effect as the user clicking the real add-button
              // themselves — opens that page's own add-modal — then hands
              // off from the guided tour so the modal isn't hidden behind it.
              document
                .querySelector<HTMLElement>(step.target as string)
                ?.click();
              finishOnboarding();
            }}
            className="mt-3 w-full rounded-md bg-primary py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-primary-strong"
          >
            {step.actionLabel} →
          </button>
        ) : (
          step.actionHref && (
            <button
              type="button"
              onClick={() => router.push(step.actionHref as string)}
              className="mt-3 text-[12px] font-semibold text-primary hover:underline"
            >
              {step.actionLabel} →
            </button>
          )
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1">
            {TOUR_STEPS.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  i === tourStep ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {tourStep > 0 && (
              <button
                type="button"
                onClick={prevTourStep}
                className="rounded-md px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-accent"
              >
                Kembali
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="rounded-md bg-primary px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-primary-strong"
            >
              {isLastStep ? "Selesai" : "Lanjut"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
