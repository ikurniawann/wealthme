// Local on purpose: @/lib/query-keys is a protected file.
// Every key starts with ["tax", fgId] so the existing queryKeys.tax.list(fgId)
// invalidation refreshes them too.
export const taxKeys = {
  pphOpPreview: (fg: string, req: unknown) =>
    ["tax", fg, "pph-op-preview", req] as const,
  terPreview: (fg: string, req: unknown) =>
    ["tax", fg, "ter-preview", req] as const,
  umkmPreview: (fg: string, req: unknown) =>
    ["tax", fg, "umkm-preview", req] as const,
  umkmYear: (fg: string, year: number) => ["tax", fg, "umkm", year] as const,
  finalTax: (fg: string, year: number) =>
    ["tax", fg, "final-tax", year] as const,
  finalIncome: (fg: string, year: number) =>
    ["tax", fg, "final-income", year] as const,
  summary: (fg: string, year: number) => ["tax", fg, "summary", year] as const,
  investmentTax: (fg: string, year: number) =>
    ["investment-tax", fg, year] as const,
  rules: (date: string, keys: readonly string[]) =>
    ["tax-rules", date, keys] as const,
  ppn: (req: unknown) => ["ppn-preview", req] as const,
};
