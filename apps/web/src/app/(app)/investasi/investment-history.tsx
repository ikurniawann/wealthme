"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type {
  PlatformAccountDto,
  TransactionDto,
  TransactionListResponse,
} from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { apiFetch } from "@/lib/api-client";
import { LedgerCorrection } from "./ledger-correction";
import { money } from "./portfolio-model";
import { today } from "./investment-fields";
import type { PortfolioActivity } from "./portfolio-overview";

export function InvestmentHistory({
  rows,
  platforms,
  fg,
  token,
  loading,
  error,
  canManage,
  onSaved,
}: {
  rows: PortfolioActivity[];
  platforms: PlatformAccountDto[];
  fg: string;
  token: string;
  loading: boolean;
  error: boolean;
  canManage: boolean;
  onSaved: () => void;
}) {
  const { t, locale } = useLocale();
  const c = t.investasi.v3;
  const f = t.investasi.forms;
  const { hideBalance } = useMoney();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<{
    row: PortfolioActivity;
    voiding: boolean;
  } | null>(null);
  const pocketIds = platforms.flatMap((p) =>
    (p.pockets ?? []).map((p) => p.id),
  );
  const cash = useQuery({
    queryKey: ["investment-pocket-history", fg, token, pocketIds.join(",")],
    queryFn: async () => {
      const groups = await Promise.all(
        pocketIds.map(async (id) => {
          const list: TransactionDto[] = [];
          let current = 1;
          let total = 0;
          do {
            const response = await apiFetch<TransactionListResponse>(
              `/family-groups/${fg}/transactions?accountId=${id}&limit=100&page=${current}`,
              { token },
            );
            if (!response.data.length) break;
            list.push(...response.data);
            total = response.meta.total;
            current++;
          } while (list.length < total);
          return list;
        }),
      );
      return [...new Map(groups.flat().map((row) => [row.id, row])).values()];
    },
    enabled: !!fg && !!token,
  });
  const linkedCash = useMemo(
    () =>
      new Set(
        rows.flatMap((r) => (r.cashTransactionId ? [r.cashTransactionId] : [])),
      ),
    [rows],
  );
  const data = useMemo(
    () =>
      [
        ...rows.map((row) => ({
          id: row.id,
          name: row.holdingName,
          date: row.effectiveDate ?? row.occurredAt.slice(0, 10),
          kind: row.kind ?? row.type ?? "opening",
          status:
            row.status === "void"
              ? "void"
              : row.settlementDate && row.settlementDate > today()
                ? "pending"
                : "settled",
          value:
            row.costBasisKnown === false && row.kind === "opening"
              ? null
              : (row.netAmount ?? row.grossAmount ?? null),
          currency: row.currency ?? "IDR",
          ledger: row,
          cash: null as TransactionDto | null,
        })),
        ...(cash.data ?? [])
          .filter((row) => !linkedCash.has(row.id))
          .map((row) => ({
            id: row.id,
            name:
              row.description ??
              `${row.accountName ?? "—"} → ${row.toAccountName ?? "—"}`,
            date: new Intl.DateTimeFormat("sv-SE", {
              timeZone: "Asia/Jakarta",
            }).format(new Date(row.occurredAt)),
            kind: row.type === "expense" ? "fee" : "transfer",
            status: "settled",
            value: row.amount,
            currency: "IDR",
            ledger: null,
            cash: row,
          })),
      ]
        .filter(
          (row) =>
            (!status || row.status === status) &&
            (!kind || row.kind === kind) &&
            (!from || row.date >= from) &&
            (!to || row.date <= to) &&
            row.name.toLowerCase().includes(search.toLowerCase()),
        )
        .sort(
          (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
        ),
    [rows, cash.data, status, kind, from, to, search, linkedCash],
  );
  const pages = Math.max(1, Math.ceil(data.length / 20));
  const current = Math.min(page, pages);
  const allKinds = [
    "buy",
    "sell",
    "opening",
    "dividend",
    "coupon",
    "interest",
    "corporate_action",
    "transfer",
    "fee",
  ] as const;
  return (
    <section className="iv-card">
      <h2>{c.history}</h2>
      <div className="iv-history-filters">
        <label className="field">
          <span className="label">{c.search}</span>
          <input
            className="input"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="field">
          <span className="label">{f.kind}</span>
          <select
            className="select"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{c.all}</option>
            {allKinds.map((k) => (
              <option key={k} value={k}>
                {k === "fee" ? f.fee : k === "transfer" ? f.transfer : c[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">{f.status}</span>
          <select
            className="select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{c.all}</option>
            {(["settled", "pending", "void"] as const).map((s) => (
              <option key={s} value={s}>
                {c[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">{f.date} ≥</span>
          <input
            className="input"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="field">
          <span className="label">{f.date} ≤</span>
          <input
            className="input"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      {error || cash.isError ? (
        <p role="alert">{c.activityError}</p>
      ) : loading || cash.isPending ? (
        <p role="status">{c.loading}</p>
      ) : !data.length ? (
        <p className="iv-empty">{f.historyEmpty}</p>
      ) : (
        <ul className="iv-activities">
          {data.slice((current - 1) * 20, current * 20).map((row) => (
            <li key={row.id}>
              <span>{row.date}</span>
              <div>
                <strong>{row.name}</strong>
                <small>
                  {row.kind === "fee"
                    ? f.fee
                    : row.kind === "transfer"
                      ? f.transfer
                      : c[row.kind as keyof typeof c]}
                </small>
                {row.ledger?.note?.includes("legacy-residual") && (
                  <small>{c.legacy}</small>
                )}
              </div>
              <span>{money(row.value, row.currency, locale, hideBalance)}</span>
              <span>{c[row.status as "void" | "pending" | "settled"]}</span>
              <div className="iv-tools">
                {row.ledger && row.ledger.status !== "void" && canManage && (
                  <>
                    <button
                      className="btn btn--outline"
                      onClick={() =>
                        setEdit({ row: row.ledger!, voiding: false })
                      }
                    >
                      {f.edit}
                    </button>
                    <button
                      className="btn btn--outline"
                      onClick={() =>
                        setEdit({ row: row.ledger!, voiding: true })
                      }
                    >
                      {f.voidAction}
                    </button>
                  </>
                )}
                {row.cash && (
                  <Link
                    className="btn btn--outline"
                    href={`/transaksi?tx=${row.cash.id}&accountId=${row.cash.accountId ?? row.cash.toAccountId ?? ""}`}
                  >
                    {f.manageTransfer}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <nav className="iv-pagination" aria-label={c.page}>
        <button
          className="btn btn--outline"
          disabled={current === 1}
          onClick={() => setPage(current - 1)}
        >
          {c.previous}
        </button>
        <span>
          {c.page} {current}/{pages}
        </span>
        <button
          className="btn btn--outline"
          disabled={current === pages}
          onClick={() => setPage(current + 1)}
        >
          {c.next}
        </button>
      </nav>
      {edit && (
        <LedgerCorrection
          row={edit.row}
          voiding={edit.voiding}
          fg={fg}
          token={token}
          onClose={() => setEdit(null)}
          onSaved={onSaved}
          percentPrice={edit.row.percentPrice}
          holdingCurrency={edit.row.holdingCurrency}
        />
      )}
    </section>
  );
}
