import Link from "next/link";
import { ArrowRight, Check, Circle, X } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import type { SetupStepId } from "./setup-checklist";

const STEP_HREFS: Record<SetupStepId, string> = {
  account: "/rekening",
  budget: "/anggaran",
  transaction: "/transaksi",
  family: "/iam",
  goal: "/tujuan",
};

export function SetupChecklistCard({
  steps,
  completedCount,
  nextStep,
  complete,
  onDismiss,
}: {
  steps: { id: SetupStepId; complete: boolean }[];
  completedCount: number;
  nextStep: SetupStepId | null;
  complete: boolean;
  onDismiss: () => void;
}) {
  const { t } = useLocale();
  const copy = t.beranda.setupChecklist;

  return (
    <section
      className="rounded-xl border bg-card p-4"
      aria-labelledby="setup-checklist-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="setup-checklist-title" className="text-sm font-bold">
            {copy.title}
          </h2>
          <p
            className="mt-1 text-xs text-muted-foreground"
            role="progressbar"
            aria-label={copy.title}
            aria-valuemin={0}
            aria-valuemax={5}
            aria-valuenow={completedCount}
            aria-valuetext={copy.progressLabelTemplate.replace(
              "{completed}",
              String(completedCount),
            )}
          >
            {completedCount}/5
          </p>
        </div>
        {complete && (
          <button
            type="button"
            aria-label={copy.dismissAriaLabel}
            onClick={onDismiss}
            className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${(completedCount / 5) * 100}%` }}
        />
      </div>

      <ol className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step) => (
          <li
            key={step.id}
            className="flex min-h-10 items-center gap-2 text-xs text-muted-foreground"
          >
            {step.complete ? (
              <Check
                className="size-4 shrink-0 text-success"
                aria-hidden="true"
              />
            ) : (
              <Circle className="size-4 shrink-0" aria-hidden="true" />
            )}
            <span>{copy.steps[step.id]}</span>
          </li>
        ))}
      </ol>

      {nextStep && (
        <Link
          href={STEP_HREFS[nextStep]}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-strong"
        >
          {copy.nextStep}: {copy.steps[nextStep]}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
