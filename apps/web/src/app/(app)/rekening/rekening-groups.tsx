"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  EllipsisVertical,
  HandCoins,
  List,
  Palette,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { FxRatesResponse } from "@wealthme/contracts";

import { AccountCard, type CardLook } from "@/components/wm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { fill } from "@/i18n/rekening-v3";

import { bankShortLabel } from "./bank-directory";
import { formatDay } from "./format-day";
import type { BankGroup, Exposure, RekeningRow } from "./rekening-model";
import type { RekeningView } from "./rekening-filters";

export interface RowActions {
  onEdit: (row: RekeningRow) => void;
  onDelete: (row: RekeningRow) => void;
  onCustomize: (row: RekeningRow) => void;
  onRequest: (row: RekeningRow) => void;
  onAddAtBank: (bankName: string, country: string) => void;
}

interface GroupsProps extends RowActions {
  groups: readonly BankGroup[];
  view: RekeningView;
  exposures: readonly Exposure[];
  rates: FxRatesResponse | undefined;
  lookFor: (id: string, type: string) => CardLook;
  myUserId: string | undefined;
  canManage: boolean;
  isMasterLike: boolean;
  grandTotal: number;
  highlightId: string | null;
}

/** Native-currency amount of an IDR balance at today's rate, or null. */
function nativeAmount(
  row: RekeningRow,
  rates: FxRatesResponse | undefined,
): string | null {
  const cur = row.account.currency;
  if (!cur || cur === "IDR" || row.balance === null) return null;
  const perUnit = Number(
    rates?.idrPerUnit?.[cur as keyof FxRatesResponse["idrPerUnit"]] ?? NaN,
  );
  if (!Number.isFinite(perUnit) || perUnit <= 0) return null;
  return `${cur} ${(row.balance / perUnit).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Rekening v3 — accounts grouped per bank. Each group header carries the
 * bank's total, its share, and deposit-insurance use per holder; cards stay
 * the default view (the family wanted their cards), the table is the dense
 * alternative.
 */
export function RekeningGroups(props: GroupsProps) {
  const { groups, view } = props;
  return (
    <div className="rk3-groups">
      {groups.map((g) => (
        <GroupBlock key={g.key} group={g} {...props} view={view} />
      ))}
    </div>
  );
}

function GroupBlock(props: GroupsProps & { group: BankGroup }) {
  const { group: g, exposures, grandTotal, canManage, onAddAtBank } = props;
  const { t } = useLocale();
  const c = t.rekening.v3;
  const money = useMoney();
  const [showEmpty, setShowEmpty] = useState(false);
  const rows = showEmpty ? [...g.rows, ...g.emptyRows] : g.rows;
  const groupExposures = exposures.filter((e) => e.key.startsWith(`${g.key}|`));
  const top = groupExposures[0];
  const share = grandTotal > 0 ? Math.round((g.total / grandTotal) * 100) : 0;
  const kindLabel = g.bank ? c.institutionKinds[g.bank.kind] : null;

  return (
    <section
      className="wm-card rk3-group"
      aria-label={g.bankName}
      data-span={
        rows.length + (canManage ? 1 : 0) > 2 || props.view === "table"
          ? "wide"
          : "half"
      }
    >
      <header className="rk3-gh">
        <span
          className="rk3-logo"
          style={{ background: g.bank?.color ?? "var(--wm-forest, #0f3d2e)" }}
          aria-hidden="true"
        >
          {bankShortLabel(g.bankName, g.bankName)}
        </span>
        <div className="min-w-0">
          <h2>
            {g.bankName}
            {g.country !== "ID" && (
              <span className="rk3-country">
                {" "}
                · {c.countries[g.country] ?? g.country}
              </span>
            )}
          </h2>
          <p>
            {[
              kindLabel,
              fill(c.page.accountsCount, {
                n: g.rows.length + g.emptyRows.length,
              }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {top && (
          <div className="rk3-lps" data-over={top.ratio > 1 || undefined}>
            <small>
              {fill(
                top.ratio > 1 ? c.page.insuranceChipOver : c.page.insuranceChip,
                {
                  insurer: top.insurer,
                  p: Math.round(top.ratio * 100),
                },
              )}{" "}
              · {top.holderLabel}
            </small>
            <span className="rk3-lps-bar" aria-hidden="true">
              <span
                style={{
                  width: `${Math.min(100, Math.round(top.ratio * 100))}%`,
                }}
              />
            </span>
          </div>
        )}
        <div className="rk3-gtot">
          <b className="wm-num">{money.formatBalance(g.total)}</b>
          <small>{fill(c.page.shareOfTotal, { p: share })}</small>
        </div>
      </header>

      {props.view === "cards" ? (
        <div className="rk3-cards">
          {rows.map((row) => (
            <CardItem key={row.account.id} row={row} {...props} />
          ))}
          {canManage && (
            <button
              type="button"
              className="rk3-addc"
              onClick={() => onAddAtBank(g.bankName, g.country)}
            >
              <Plus aria-hidden="true" />
              {fill(c.page.addAtBank, { bank: g.bankName })}
            </button>
          )}
        </div>
      ) : (
        <div className="rk3-table" role="table" aria-label={g.bankName}>
          <div className="rk3-tr rk3-th" role="row">
            <span role="columnheader">{c.page.colAccount}</span>
            <span role="columnheader">{c.page.colKind}</span>
            <span role="columnheader">{c.page.colHolder}</span>
            <span role="columnheader">{c.page.colAccess}</span>
            <span role="columnheader">{c.page.colTerms}</span>
            <span role="columnheader" className="rk3-r">
              {c.page.colBalance}
            </span>
            <span role="columnheader" aria-label={c.page.options} />
          </div>
          {rows.map((row) => (
            <TableRow key={row.account.id} row={row} {...props} />
          ))}
        </div>
      )}

      {g.emptyRows.length > 0 && (
        <button
          type="button"
          className="rk3-gfoot"
          onClick={() => setShowEmpty((v) => !v)}
          aria-expanded={showEmpty}
        >
          {showEmpty
            ? c.page.hideEmpty
            : `${fill(c.page.hiddenEmpty, { n: g.emptyRows.length })} · ${c.page.showEmpty}`}
        </button>
      )}
    </section>
  );
}

function useRowText(row: RekeningRow) {
  const { t, locale } = useLocale();
  const c = t.rekening.v3;
  const a = row.account;
  const kind = (row.country === "ID" ? c.kinds : c.kindsForeign)[row.kind];
  const rate =
    a.interestRate !== null && a.interestRate !== undefined
      ? a.isSharia && a.shariaContract === "mudharabah"
        ? `${c.form.nisbah} ${String(a.interestRate).replace(".", ",")}%`
        : fill(c.page.perAnnum, {
            rate: String(a.interestRate).replace(".", ","),
          })
      : null;
  const maturity =
    row.maturity !== null
      ? `${a.maturityInstruction ? `${c.instructions[a.maturityInstruction]} · ` : ""}${fill(c.page.matures, { date: formatDay(row.maturity, locale) })} · ${
          (row.daysToMaturity ?? 0) < 0
            ? c.page.matured
            : fill(c.page.daysLeft, { n: row.daysToMaturity ?? 0 })
        }`
      : null;
  const activity =
    row.idleDays >= 90
      ? fill(c.page.idleDays, { n: row.idleDays })
      : a.lastActivityAt
        ? fill(c.page.lastActivity, {
            date: formatDay(a.lastActivityAt, locale),
          })
        : c.page.noActivity;
  return { c, kind, rate, maturity, activity };
}

function badgesFor(
  row: RekeningRow,
  c: ReturnType<typeof useRowText>["c"],
  kind: string,
) {
  const a = row.account;
  const out: string[] = [kind];
  if (a.isPrivate) out.push(c.page.privateBadge);
  else if (a.ownerUserId === null) out.push(c.page.familyBadge);
  if (a.status && a.status !== "active") out.unshift(c.statuses[a.status]);
  else if (a.isPrimary) out.push(c.page.primaryBadge);
  // Two badges fit the card face on one line; the rest lives in the meta line.
  return out.slice(0, 2);
}

function CardItem(props: GroupsProps & { row: RekeningRow }) {
  const { row, lookFor, rates, canManage, isMasterLike, highlightId } = props;
  const router = useRouter();
  const money = useMoney();
  const { c, kind, rate, maturity, activity } = useRowText(row);
  const a = row.account;
  const native = nativeAmount(row, rates);
  const number = a.maskedNumber
    ? `**** ${a.maskedNumber.replace(/\D/g, "").slice(-4)}`
    : a.depositNumber
      ? a.depositNumber
      : null;
  const sharedNames = (a.shares ?? []).map((s) => s.name);
  const goMutasi = () =>
    router.push(`/transaksi?accountId=${encodeURIComponent(a.id)}`);
  return (
    <article
      id={`rk-${a.id}`}
      className="rk3-cw"
      data-highlight={highlightId === a.id || undefined}
      data-dim={a.status === "closed" || a.status === "dormant" || undefined}
    >
      <AccountCard
        look={lookFor(a.id, a.type)}
        bank={
          row.bank && row.bank.name.length > 9 ? row.bank.short : row.bankName
        }
        name={a.productName || a.name}
        number={number}
        holder={row.holderLabel}
        balance={
          native && row.balance !== null
            ? native
            : money.formatBalance(row.balance)
        }
        badge={
          <span className="rk-card-badges">
            {badgesFor(row, c, kind).map((b) => (
              <span key={b} className="wm-plate-badge">
                {b}
              </span>
            ))}
          </span>
        }
      />
      <p className="rk3-meta">
        {[
          rate,
          maturity,
          native && row.balance !== null
            ? fill(c.page.viaRate, { amount: money.format(row.balance) })
            : null,
          sharedNames.length > 0
            ? `${c.form.sharedWith} ${sharedNames.join(", ")}`
            : null,
          row.country !== "ID" && a.reportInTaxReturn
            ? c.page.reportTaxBadge
            : null,
          activity,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {row.kind === "time_deposit" &&
      row.daysToMaturity !== null &&
      a.tenorMonths ? (
        <span className="rk3-mat" aria-hidden="true">
          <span
            style={{
              width: `${Math.max(
                0,
                Math.min(
                  100,
                  100 - (row.daysToMaturity / (a.tenorMonths * 30.4)) * 100,
                ),
              )}%`,
            }}
          />
        </span>
      ) : null}
      <div className="rk-card-acts">
        <button
          type="button"
          className="rk-card-btn"
          onClick={goMutasi}
          aria-label={`${c.page.mutasi} ${a.name}`}
        >
          <List aria-hidden="true" /> {c.page.mutasi}
        </button>
        {!isMasterLike && a.ownerUserId === null && (
          <button
            type="button"
            className="rk-card-btn"
            data-lit="true"
            onClick={() => props.onRequest(row)}
          >
            <HandCoins aria-hidden="true" /> {c.page.requestFunds}
          </button>
        )}
        <button
          type="button"
          className="rk-card-icon"
          aria-label={c.page.customize}
          title={c.page.customize}
          onClick={() => props.onCustomize(row)}
        >
          <Palette aria-hidden="true" />
        </button>
        <RowMenu
          row={row}
          canManage={canManage}
          onMutasi={goMutasi}
          onEdit={props.onEdit}
          onDelete={props.onDelete}
          onCustomize={props.onCustomize}
          onRequest={props.onRequest}
          onAddAtBank={props.onAddAtBank}
        />
      </div>
    </article>
  );
}

function RowMenu({
  row,
  canManage,
  onMutasi,
  onEdit,
  onDelete,
  onCustomize,
}: RowActions & {
  row: RekeningRow;
  canManage: boolean;
  onMutasi: () => void;
}) {
  const { t } = useLocale();
  const c = t.rekening.v3;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${c.page.options} ${row.account.name}`}
        render={<button type="button" className="rk-card-icon" />}
      >
        <EllipsisVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rk3-menu">
        <DropdownMenuItem onClick={onMutasi}>
          <List aria-hidden="true" />
          {c.page.mutasi}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCustomize(row)}>
          <Palette aria-hidden="true" />
          {c.page.customizeShort}
        </DropdownMenuItem>
        {canManage && (
          <>
            <DropdownMenuItem onClick={() => onEdit(row)}>
              <Pencil aria-hidden="true" />
              {c.page.edit}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(row)}
            >
              <Trash2 aria-hidden="true" />
              {c.page.remove}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TableRow(props: GroupsProps & { row: RekeningRow }) {
  const { row, rates, canManage, highlightId } = props;
  const router = useRouter();
  const money = useMoney();
  const { c, kind, rate, maturity, activity } = useRowText(row);
  const a = row.account;
  const native = nativeAmount(row, rates);
  const access = a.isPrivate
    ? c.page.privateBadge
    : a.ownerUserId === null
      ? c.page.familyBadge
      : (a.ownerName ?? "—");
  const shares = (a.shares ?? []).length;
  return (
    <div
      id={`rk-${a.id}`}
      className="rk3-tr"
      role="row"
      data-highlight={highlightId === a.id || undefined}
      data-dim={a.status === "closed" || a.status === "dormant" || undefined}
    >
      <span role="cell" className="rk3-tname">
        <b>{a.productName || a.name}</b>
        <small className="wm-num">
          {[
            a.maskedNumber
              ? `•••• ${a.maskedNumber.slice(-4)}`
              : a.depositNumber,
            a.branch,
            activity,
          ]
            .filter(Boolean)
            .join(" · ")}
        </small>
      </span>
      <span role="cell">
        <span className="rk3-tag" data-kind={row.kind}>
          {kind}
        </span>
      </span>
      <span role="cell" className="rk3-own">
        {row.holderLabel}
      </span>
      <span role="cell">
        <span className="rk3-tag">{access}</span>
        {shares > 0 && (
          <small className="rk3-sharecount">
            {fill(c.page.sharedCount, { n: shares })}
          </small>
        )}
      </span>
      <span role="cell" className="rk3-terms">
        {[rate, maturity].filter(Boolean).join(" · ") || "—"}
      </span>
      <span role="cell" className="rk3-r rk3-bal">
        <b className="wm-num">{native ?? money.formatBalance(row.balance)}</b>
        {native && (
          <small>
            {fill(c.page.viaRate, { amount: money.format(row.balance ?? 0) })}
          </small>
        )}
      </span>
      <span role="cell">
        <RowMenu
          row={row}
          canManage={canManage}
          onMutasi={() =>
            router.push(`/transaksi?accountId=${encodeURIComponent(a.id)}`)
          }
          onEdit={props.onEdit}
          onDelete={props.onDelete}
          onCustomize={props.onCustomize}
          onRequest={props.onRequest}
          onAddAtBank={props.onAddAtBank}
        />
      </span>
    </div>
  );
}
