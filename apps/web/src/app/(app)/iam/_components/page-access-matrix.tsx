"use client";

import { useId } from "react";
import type { AccessLevel, AccessPage } from "@wealthme/contracts";

import { useLocale } from "@/hooks/use-locale";
import { cn } from "@/lib/utils";

import { LEVEL_HINT, LEVEL_OPTIONS, PAGE_GROUPS } from "./access-shared";

type PageAccessMatrixProps = {
  value: Record<AccessPage, AccessLevel>;
  onChange: (page: AccessPage, level: AccessLevel) => void;
  /**
   * The role's own level per page. When given, a page whose value differs is
   * marked "Khusus" (a per-member override) with a way back to the role.
   */
  baseline?: Record<AccessPage, AccessLevel>;
  disabled?: boolean;
};

const DOT: Record<AccessLevel, string> = {
  none: "bg-muted-foreground/40",
  view: "bg-sky-500",
  manage: "bg-emerald-500",
};

/**
 * One row per page, grouped like the sidebar, each with a 3-way
 * Tidak / Lihat / Kelola control. Rendered as a radiogroup per page so
 * keyboard and screen-reader users get the same model as the visual one.
 */
export function PageAccessMatrix({
  value,
  onChange,
  baseline,
  disabled,
}: PageAccessMatrixProps) {
  const { t } = useLocale();
  const nameId = useId();

  const setGroup = (pages: AccessPage[], level: AccessLevel) =>
    pages.forEach((p) => onChange(p, level));

  return (
    <div className="stack" style={{ gap: 14 }}>
      {PAGE_GROUPS.map((group) => {
        const title = group.headerKey
          ? t.shell.navSectionHeaders[group.headerKey]
          : "Umum";
        return (
          <section key={title} aria-label={title}>
            <div className="row row--between mb-1.5">
              <h4 className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
                {title}
              </h4>
              {!disabled && (
                <div className="row" style={{ gap: 4 }}>
                  <span className="t-xs t-muted">Semua:</span>
                  {LEVEL_OPTIONS.map((o) => (
                    <button
                      key={o.level}
                      type="button"
                      className="btn btn--ghost btn--sm"
                      style={{ paddingInline: 8 }}
                      onClick={() => setGroup(group.pages, o.level)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ul className="divide-y rounded-[10px] border">
              {group.pages.map((page) => {
                const level = value[page];
                const label = t.shell.navSections[page];
                const overridden =
                  baseline !== undefined && baseline[page] !== level;
                return (
                  <li
                    key={page}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          DOT[level],
                        )}
                      />
                      <span className="text-[13px] font-semibold">{label}</span>
                      {overridden && (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => onChange(page, baseline[page])}
                          className="badge badge--warning"
                          title="Klik untuk kembali ke pengaturan role"
                        >
                          Khusus · kembalikan
                        </button>
                      )}
                    </div>
                    {/* Native radios (visually a segmented control): one Tab
                        stop per page, arrow keys move the choice. */}
                    <div
                      role="radiogroup"
                      aria-label={`Akses ${label}`}
                      className="segmented"
                    >
                      {LEVEL_OPTIONS.map((o) => (
                        <label
                          key={o.level}
                          title={LEVEL_HINT[o.level]}
                          className="segmented__item has-[:checked]:bg-card has-[:checked]:text-foreground has-[:checked]:shadow-[var(--shadow-card)] has-[:disabled]:cursor-not-allowed has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40"
                        >
                          <input
                            type="radio"
                            className="sr-only"
                            name={`${nameId}-${page}`}
                            value={o.level}
                            checked={level === o.level}
                            disabled={disabled}
                            onChange={() => onChange(page, o.level)}
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
