"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { TaxRuleRefDto } from "@wealthme/contracts";

// Polish batch 7b (item 1) — every calculator on /tax used to render its own
// "perkiraan — cek aturan terbaru DJP" badge, repeating the same sentence in
// up to 5 places. Panels report their flagged rules here instead of
// rendering their own badge; a single aggregate badge (in AnnualSummary,
// already the page's top "answer" block) shows the union, deduped by
// `key|effectiveFrom`, so no per-rule detail is lost.
type RuleMap = Record<string, readonly TaxRuleRefDto[]>;

const TaxRulesContext = createContext<{
  rules: RuleMap;
  report: (id: string, rules: readonly TaxRuleRefDto[]) => void;
} | null>(null);

export function TaxRulesProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<RuleMap>({});
  const report = useCallback((id: string, next: readonly TaxRuleRefDto[]) => {
    setRules((prev) => {
      const prevJson = JSON.stringify(prev[id] ?? []);
      const nextJson = JSON.stringify(next);
      if (prevJson === nextJson) return prev;
      return { ...prev, [id]: next };
    });
  }, []);
  const value = useMemo(() => ({ rules, report }), [rules, report]);
  return (
    <TaxRulesContext.Provider value={value}>
      {children}
    </TaxRulesContext.Provider>
  );
}

/** A panel calls this with its own preview result's rules whenever they change. */
export function useReportTaxRules(
  id: string,
  rules: readonly TaxRuleRefDto[],
): void {
  const ctx = useContext(TaxRulesContext);
  const rulesJson = JSON.stringify(rules);
  useEffect(() => {
    ctx?.report(id, rules);
    // rulesJson is the real dependency (stable content check); ctx.report is
    // stable via useCallback above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, id, rulesJson]);
}

/** The aggregate badge reads every reported rule, deduped. */
export function useAllTaxRules(): TaxRuleRefDto[] {
  const ctx = useContext(TaxRulesContext);
  return useMemo(() => {
    if (!ctx) return [];
    const seen = new Map<string, TaxRuleRefDto>();
    for (const list of Object.values(ctx.rules)) {
      for (const r of list) {
        seen.set(`${r.key}|${r.effectiveFrom}`, r);
      }
    }
    return [...seen.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.rules]);
}
