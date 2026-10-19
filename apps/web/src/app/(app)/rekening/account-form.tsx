"use client";

import {
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  BANK_COUNTRIES,
  bankCountry,
  estimateNetInterest,
  nextMaturityDate,
  type AccountDto,
  type BankProductKind,
  type FxCurrencyCode,
} from "@wealthme/contracts";

import {
  Dialog,
  DialogClose,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { DateField, PillButton } from "@/components/wm";
import {
  MoneyInput,
  useControlledMoneyField,
  useDefaultMoneyCurrency,
  useFxSnapshot,
} from "@/components/money";
import { idrPreview, toCanonicalAmount } from "@/components/money/money-format";
import { AddToMasterDataLink } from "@/components/crud/add-to-master-data-link";
import { useLocale } from "@/hooks/use-locale";
import { useReferenceItems } from "@/hooks/use-reference-items";
import { useMoney } from "@/hooks/use-money";
import { apiFetch } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { fill } from "@/i18n/rekening-v3";

import {
  OTHER,
  TENOR_PRESETS,
  applyBank,
  applyCountry,
  createBodies,
  editBody,
  initialFormState,
  parseRate,
  validateForm,
  type AccountFormState,
  type ConvertedBalance,
  type FormErrors,
  type MoneyRow,
  type ShareRight,
} from "./account-form-state";
import { banksForCountry, findKnownBank } from "./bank-directory";
import { formatDay } from "./format-day";
import { insuranceExposures, toRows } from "./rekening-model";

export interface FormMember {
  userId: string;
  name: string;
  role: string;
  dataScope?: "all" | "own";
}

export interface AccountFormOpen {
  mode: "add" | "edit";
  account: AccountDto | null;
  preset?: { productKind?: BankProductKind; country?: string; bank?: string };
}

interface AccountFormProps {
  open: AccountFormOpen | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  members: readonly FormMember[];
  accounts: readonly AccountDto[];
  familyGroupId: string | undefined;
  token: string | undefined;
  myUserId: string | undefined;
  isMasterLike: boolean;
}

/** Rekening v3 — the bank-account form (Tabungan, Giro, Deposito, foreign). */
export function AccountForm(props: AccountFormProps) {
  if (!props.open) return null;
  const key = `${props.open.mode}:${props.open.account?.id ?? "new"}`;
  return <AccountFormBody key={key} {...props} open={props.open} />;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AccountFormBody({
  open,
  onClose,
  onSaved,
  members,
  accounts,
  familyGroupId,
  token,
  myUserId,
  isMasterLike,
}: AccountFormProps & { open: AccountFormOpen }) {
  const { t, locale } = useLocale();
  const c = t.rekening.v3;
  const money = useMoney();
  const uid = useId();
  const today = todayIso();
  const ctx = { myUserId, isMasterLike, today };
  const isEdit = open.mode === "edit";
  const displayCurrency = useDefaultMoneyCurrency();

  const [s, setS] = useState<AccountFormState>(() => {
    const base = initialFormState(open.account, ctx, open.preset);
    return open.preset?.bank ? applyBank(base, open.preset.bank) : base;
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(
    () => !!(open.account?.branch || open.account?.notes),
  );

  const set = <K extends keyof AccountFormState>(
    key: K,
    value: AccountFormState[K],
  ) => setS((prev) => ({ ...prev, [key]: value }));

  const scheme = bankCountry(s.country);
  const domestic = s.country === "ID";
  const deposit = s.productKind === "time_deposit";
  const kindLabels = domestic ? c.kinds : c.kindsForeign;
  const kindLabel = kindLabels[s.productKind];

  // ── Bank options: directory + the family's Master Data banks ────────────
  const { items: refBanks } = useReferenceItems("bank", { enabled: domestic });
  const bankOptions = useMemo(() => {
    const names = banksForCountry(s.country).map((b) => b.name);
    if (domestic) {
      for (const item of refBanks) {
        const known = findKnownBank(item.label);
        const name = known?.name ?? item.label;
        if (item.label !== "Bank Lainnya" && !names.includes(name))
          names.push(name);
      }
    }
    if (s.bank && !names.includes(s.bank) && !s.bankOther) names.push(s.bank);
    return names;
  }, [s.country, s.bank, s.bankOther, domestic, refBanks]);
  const known = findKnownBank(s.bank);
  const productSuggestions = known?.products ?? [];

  // ── Money ────────────────────────────────────────────────────────────────
  const anyForeign = s.balances.some(
    (b) => (b.currency ?? displayCurrency) !== "IDR",
  );
  const { data: rates } = useFxSnapshot(anyForeign || !domestic);
  const converted: Array<ConvertedBalance | null> = s.balances.map((row) => {
    const currency = row.currency ?? displayCurrency;
    const canonical = toCanonicalAmount(row.raw) ?? "0";
    if (currency === "IDR")
      return { currency, idr: Number(canonical), fxAmount: null };
    const preview = idrPreview(canonical, currency, rates, 0);
    return preview === null
      ? null
      : { currency, idr: Number(preview), fxAmount: canonical };
  });
  const principalIdr = converted.reduce((sum, b) => sum + (b?.idr ?? 0), 0);

  // ── Deposit preview ──────────────────────────────────────────────────────
  const tenor = Number(s.tenorMonths);
  const maturity = deposit
    ? nextMaturityDate(s.placementDate, tenor, s.maturityInstruction, today)
    : null;
  const rate = parseRate(s.interestRate);
  const netPerTenor =
    deposit && rate && tenor > 0 && !isEdit
      ? estimateNetInterest(principalIdr, rate, tenor, domestic)
      : null;

  // ── Insurance preview (same rule as the page) ────────────────────────────
  const holderMember = members.find((m) => m.userId === s.holder);
  const holderLabel =
    s.holder === OTHER ? s.holderName.trim() : (holderMember?.name ?? "");
  const exposure = (() => {
    if (!s.bank || !holderLabel) return null;
    const others = accounts.filter((a) => a.id !== open.account?.id);
    const draft: AccountDto = {
      id: "__draft",
      familyGroupId: "",
      name: s.bank,
      type: "bank",
      institution: s.bank,
      maskedNumber: null,
      balance: String(isEdit ? (open.account?.balance ?? "0") : principalIdr),
      currency: "IDR",
      isPrivate: false,
      ownerUserId: null,
      ownerName: null,
      createdAt: `${today}T00:00:00.000Z`,
      updatedAt: `${today}T00:00:00.000Z`,
      country: s.country,
      holderUserId: s.holder === OTHER ? null : s.holder,
      holderName: s.holder === OTHER ? s.holderName : holderLabel,
    };
    const rows = toRows([...others, draft], today, { family: "" });
    const draftRow = rows.find((r) => r.account.id === "__draft");
    return (
      insuranceExposures(rows, rates).find(
        (e) =>
          draftRow && e.key === `${draftRow.bankKey}|${draftRow.holderKey}`,
      ) ?? null
    );
  })();

  // ── Members for sharing ──────────────────────────────────────────────────
  const ownerId = s.familyShared
    ? null
    : s.holder !== OTHER && s.holder !== ""
      ? s.holder
      : myUserId;
  const shareable = members.filter(
    (m) => m.dataScope === "own" && m.userId !== ownerId,
  );

  async function handleSave() {
    const found = validateForm(s);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (!familyGroupId || !token) return;
    setSaving(true);
    try {
      if (isEdit && open.account) {
        await apiFetch(
          `/family-groups/${familyGroupId}/accounts/${open.account.id}`,
          {
            token,
            method: "PATCH",
            body: JSON.stringify(editBody(s, ctx, kindLabel)),
          },
        );
        toast.success(c.form.updatedToast);
      } else {
        if (converted.some((b) => b === null)) {
          toast.error(c.form.rateMissing);
          return;
        }
        const bodies = createBodies(
          s,
          ctx,
          converted as ConvertedBalance[],
          kindLabel,
        );
        const failed: string[] = [];
        let firstError: unknown = null;
        for (const body of bodies) {
          try {
            await apiFetch(`/family-groups/${familyGroupId}/accounts`, {
              token,
              method: "POST",
              body: JSON.stringify(body),
            });
          } catch (err: unknown) {
            failed.push(String(body.currency));
            firstError ??= err;
          }
        }
        if (failed.length === bodies.length) throw firstError;
        if (failed.length > 0) {
          toast.warning(
            fill(c.form.partialToast, {
              ok: bodies.length - failed.length,
              total: bodies.length,
              failed: failed.join(", "),
            }),
          );
        } else {
          toast.success(c.form.savedToast);
        }
      }
      await onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, c.form.failedToast));
    } finally {
      setSaving(false);
    }
  }

  const err = (key: keyof FormErrors) =>
    errors[key] ? (
      <span className="error-text block" role="alert">
        {key === "swiftCode" && errors[key] === "invalid"
          ? c.form.swiftInvalid
          : c.form.required}
      </span>
    ) : null;

  const title = isEdit
    ? c.form.editTitle
    : deposit
      ? c.form.addDepositTitle
      : c.form.addTitle;
  const subtitle = !domestic
    ? c.form.subtitleForeign
    : deposit
      ? c.form.subtitleDeposit
      : c.form.subtitleBook;

  const kindOptions: BankProductKind[] = domestic
    ? ["savings", "current", "time_deposit", "planned_savings"]
    : ["savings", "current", "time_deposit", "multi_currency"];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <PanelContent variant="side" className="wm-form-panel rkf">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">{title}</DialogTitle>
            <p className="wm-panel-desc">{subtitle}</p>
          </div>
          <DialogClose className="wm-panel-x" aria-label={c.form.cancel}>
            <X aria-hidden="true" />
          </DialogClose>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="wm-panel-body wm-form rkf-body">
            {/* 1 — Institution */}
            <Section n={1} title={c.form.secInstitution}>
              <Seg
                label={c.form.country}
                value={domestic ? "ID" : "XX"}
                options={[
                  ["ID", c.form.countryDomestic],
                  ["XX", c.form.countryForeign],
                ]}
                onChange={(v) =>
                  setS((p) => applyCountry(p, v === "ID" ? "ID" : "SG"))
                }
              />
              {!domestic && (
                <label className="field">
                  <span className="label">{c.form.countryPick}</span>
                  <select
                    className="select"
                    value={s.country}
                    onChange={(e) =>
                      setS((p) => applyCountry(p, e.target.value))
                    }
                  >
                    {BANK_COUNTRIES.filter((x) => x.code !== "ID").map((x) => (
                      <option key={x.code} value={x.code}>
                        {c.countries[x.code] ?? x.code} · {x.currency}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="field">
                <label className="label rkf-label" htmlFor={`${uid}-bank`}>
                  <span>{c.form.bank}</span>
                  <em>{c.form.bankSearchHint}</em>
                </label>
                <select
                  id={`${uid}-bank`}
                  className="select"
                  value={s.bankOther ? OTHER : s.bank}
                  onChange={(e) =>
                    e.target.value === OTHER
                      ? setS((p) => ({ ...p, bankOther: true, bank: "" }))
                      : setS((p) =>
                          applyBank({ ...p, bankOther: false }, e.target.value),
                        )
                  }
                >
                  <option value="" disabled>
                    {c.form.bankPlaceholder}
                  </option>
                  {bankOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  <option value={OTHER}>{c.form.bankOther}</option>
                </select>
                {s.bankOther && (
                  <input
                    className="input mt-2"
                    aria-label={c.form.bankTyped}
                    placeholder={c.form.bankTyped}
                    value={s.bank}
                    onChange={(e) => setS((p) => applyBank(p, e.target.value))}
                  />
                )}
                {err("bank")}
                {domestic && <AddToMasterDataLink group="bank" />}
                {s.institutionKind && (
                  <div className="rkf-tags">
                    <span className="rkf-tag rkf-tag--lime">
                      {c.institutionKinds[s.institutionKind]}
                    </span>
                    {s.isSharia && (
                      <span className="rkf-tag">{c.form.sharia}</span>
                    )}
                    {s.bankCode && (
                      <span className="rkf-tag">
                        {c.form.bankCode} {s.bankCode}
                      </span>
                    )}
                    {s.swiftCode && (
                      <span className="rkf-tag">SWIFT {s.swiftCode}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="wm-form__grid wm-form__grid--two">
                {domestic ? (
                  <TextField
                    label={c.form.bankCode}
                    value={s.bankCode}
                    onChange={(v) => set("bankCode", v)}
                    mono
                  />
                ) : scheme.routingKind === "bank_code" ? (
                  <TextField
                    label={c.form.routing.bank_code}
                    value={s.bankCode}
                    onChange={(v) => set("bankCode", v)}
                    mono
                  />
                ) : (
                  <TextField
                    label={c.form.routing[scheme.routingKind]}
                    value={s.routingCode}
                    onChange={(v) => set("routingCode", v)}
                    mono
                  />
                )}
                <div>
                  <TextField
                    label={c.form.swift}
                    value={s.swiftCode}
                    onChange={(v) => set("swiftCode", v.toUpperCase())}
                    mono
                  />
                  {err("swiftCode")}
                </div>
              </div>
              {known && <p className="hint">{c.form.autoFilledHint}</p>}
              {domestic && (
                <ToggleRow
                  label={c.form.sharia}
                  hint={c.form.shariaHint}
                  checked={s.isSharia}
                  onChange={(v) =>
                    setS((p) => ({
                      ...p,
                      isSharia: v,
                      shariaContract: v ? p.shariaContract || "mudharabah" : "",
                    }))
                  }
                />
              )}
            </Section>

            {/* 2 — Product */}
            <Section n={2} title={c.form.secProduct}>
              <Seg
                label={c.form.productKind}
                value={s.productKind}
                options={kindOptions.map((k) => [k, kindLabels[k]])}
                onChange={(v) =>
                  setS((p) => ({
                    ...p,
                    productKind: v as BankProductKind,
                    balances:
                      v === "multi_currency"
                        ? p.balances
                        : p.balances.slice(0, 1),
                  }))
                }
                disabled={isEdit && s.productKind === "multi_currency"}
              />
              <div className="field">
                <label className="label rkf-label" htmlFor={`${uid}-product`}>
                  <span>{c.form.productName}</span>
                  <em>{c.form.productNameHint}</em>
                </label>
                <input
                  id={`${uid}-product`}
                  className="input"
                  placeholder={c.form.productNamePlaceholder}
                  value={s.productName}
                  onChange={(e) => set("productName", e.target.value)}
                />
                {productSuggestions.length > 0 && (
                  <div
                    className="rkf-chips"
                    role="group"
                    aria-label={c.form.productName}
                  >
                    {productSuggestions.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className="rkf-chip"
                        aria-pressed={s.productName === p}
                        onClick={() => set("productName", p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {s.isSharia && (
                <Seg
                  label={c.form.shariaContract}
                  value={s.shariaContract || "mudharabah"}
                  options={[
                    ["wadiah", c.shariaContracts.wadiah],
                    ["mudharabah", c.shariaContracts.mudharabah],
                  ]}
                  onChange={(v) =>
                    set("shariaContract", v as "wadiah" | "mudharabah")
                  }
                />
              )}
            </Section>

            {/* 3 — Identity */}
            <Section n={3} title={c.form.secIdentity}>
              <div className="wm-form__grid wm-form__grid--two">
                {deposit ? (
                  <TextField
                    label={c.form.depositNumber}
                    value={s.depositNumber}
                    onChange={(v) => set("depositNumber", v)}
                    mono
                  />
                ) : (
                  <TextField
                    label={c.form.accountNumber}
                    placeholder={c.form.accountNumberPlaceholder}
                    value={s.maskedNumber}
                    onChange={(v) => set("maskedNumber", v)}
                    mono
                    inputMode="numeric"
                  />
                )}
                {deposit ? (
                  <TextField
                    label={c.form.accountNumber}
                    value={s.maskedNumber}
                    onChange={(v) => set("maskedNumber", v)}
                    mono
                  />
                ) : (
                  <TextField
                    label={c.form.displayName}
                    placeholder={`${s.bank || "BCA"} ${s.productName || kindLabel}`}
                    value={s.displayName}
                    onChange={(v) => set("displayName", v)}
                  />
                )}
              </div>
              <div className="field">
                <label className="label rkf-label" htmlFor={`${uid}-holder`}>
                  <span>{c.form.holder}</span>
                </label>
                <select
                  id={`${uid}-holder`}
                  className="select"
                  value={s.holder}
                  onChange={(e) => set("holder", e.target.value)}
                >
                  {s.holder === "" && (
                    <option value="">{c.form.holderUnset}</option>
                  )}
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                  <option value={OTHER}>{c.form.holderOther}</option>
                </select>
                {s.holder === OTHER && (
                  <input
                    className="input mt-2"
                    aria-label={c.form.holderOtherPlaceholder}
                    placeholder={c.form.holderOtherPlaceholder}
                    value={s.holderName}
                    onChange={(e) => set("holderName", e.target.value)}
                  />
                )}
                {err("holderName")}
                <span className="hint block">{c.form.holderHint}</span>
              </div>
              <Seg
                label={c.form.ownershipForm}
                value={s.ownershipForm}
                options={[
                  ["individual", c.ownership.individual],
                  ["joint", c.ownership.joint],
                  ["qq", c.ownership.qq],
                ]}
                onChange={(v) =>
                  set("ownershipForm", v as AccountFormState["ownershipForm"])
                }
                hint={c.form.ownershipHint}
              />
            </Section>

            {/* 4 — Balance / placement */}
            <Section
              n={4}
              title={deposit ? c.form.secPlacement : c.form.secBalance}
            >
              {!isEdit && (
                <div className="field">
                  <span className="label">
                    {s.productKind === "multi_currency"
                      ? c.form.balancesPerCurrency
                      : deposit
                        ? c.form.principal
                        : c.form.openingBalance}
                  </span>
                  {s.balances.map((row, i) => (
                    <div key={i} className="rkf-money-row">
                      <BalanceInput
                        id={`${uid}-bal-${i}`}
                        row={row}
                        ariaLabel={`${c.form.openingBalance} ${i + 1}`}
                        onChange={(next) =>
                          setS((p) => ({
                            ...p,
                            balances: p.balances.map((b, j) =>
                              j === i ? next : b,
                            ),
                          }))
                        }
                      />
                      {i > 0 && (
                        <button
                          type="button"
                          className="rkf-x"
                          aria-label={c.form.removeCurrency}
                          onClick={() =>
                            setS((p) => ({
                              ...p,
                              balances: p.balances.filter((_, j) => j !== i),
                            }))
                          }
                        >
                          <X aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                  {s.productKind === "multi_currency" &&
                    s.balances.length < 6 && (
                      <button
                        type="button"
                        className="rkf-link"
                        onClick={() =>
                          setS((p) => ({
                            ...p,
                            balances: [
                              ...p.balances,
                              { raw: "", currency: "USD" as FxCurrencyCode },
                            ],
                          }))
                        }
                      >
                        {c.form.addCurrency}
                      </button>
                    )}
                </div>
              )}
              <div className="wm-form__grid wm-form__grid--two">
                <div className="field">
                  <label className="label" htmlFor={`${uid}-asof`}>
                    {deposit ? c.form.placementDate : c.form.asOf}
                  </label>
                  <DateField
                    id={`${uid}-asof`}
                    value={deposit ? s.placementDate : s.openingBalanceDate}
                    locale={locale}
                    label={deposit ? c.form.placementDate : c.form.asOf}
                    max={today}
                    onChange={(iso) =>
                      set(deposit ? "placementDate" : "openingBalanceDate", iso)
                    }
                  />
                  {deposit && err("placementDate")}
                </div>
                <div className="field">
                  <label className="label rkf-label" htmlFor={`${uid}-rate`}>
                    <span>
                      {s.isSharia && s.shariaContract === "mudharabah"
                        ? c.form.nisbah
                        : c.form.interestRate}
                    </span>
                    {!deposit && <em>{c.form.optional}</em>}
                  </label>
                  <div className="rkf-suffix">
                    <input
                      id={`${uid}-rate`}
                      className="input mono"
                      inputMode="decimal"
                      placeholder="0,75"
                      value={s.interestRate}
                      onChange={(e) =>
                        set(
                          "interestRate",
                          e.target.value.replace(/[^\d,.]/g, ""),
                        )
                      }
                    />
                    <span aria-hidden="true">%</span>
                  </div>
                  {err("interestRate")}
                </div>
              </div>
              {deposit && (
                <>
                  <div className="field">
                    <span className="label">{c.form.tenor}</span>
                    <div
                      className="segmented rkf-seg"
                      role="radiogroup"
                      aria-label={c.form.tenor}
                    >
                      {TENOR_PRESETS.map((m, i) => (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          data-value={String(m)}
                          aria-checked={s.tenorMonths === String(m)}
                          tabIndex={
                            s.tenorMonths === String(m) ||
                            (i === 0 &&
                              !TENOR_PRESETS.some(
                                (x) => String(x) === s.tenorMonths,
                              ))
                              ? 0
                              : -1
                          }
                          className="segmented__item"
                          onClick={() => set("tenorMonths", String(m))}
                          onKeyDown={(e) =>
                            radioKeys(
                              e,
                              TENOR_PRESETS.map(String),
                              s.tenorMonths,
                              (v) => set("tenorMonths", v),
                            )
                          }
                        >
                          {m} {c.form.monthsSuffix}
                        </button>
                      ))}
                    </div>
                    {!TENOR_PRESETS.some(
                      (m) => String(m) === s.tenorMonths,
                    ) && (
                      <input
                        className="input mono mt-2"
                        inputMode="numeric"
                        aria-label={c.form.tenor}
                        value={s.tenorMonths}
                        onChange={(e) =>
                          set("tenorMonths", e.target.value.replace(/\D/g, ""))
                        }
                      />
                    )}
                    {err("tenorMonths")}
                  </div>
                  <div className="wm-form__grid wm-form__grid--two">
                    <label className="field">
                      <span className="label">{c.form.interestPayout}</span>
                      <select
                        className="select"
                        value={s.interestPayout}
                        onChange={(e) =>
                          set(
                            "interestPayout",
                            e.target
                              .value as AccountFormState["interestPayout"],
                          )
                        }
                      >
                        <option value="at_maturity">
                          {c.payouts.at_maturity}
                        </option>
                        <option value="monthly">{c.payouts.monthly}</option>
                      </select>
                    </label>
                    <label className="field">
                      <span className="label">{c.form.payoutAccount}</span>
                      <select
                        className="select"
                        value={s.payoutAccountId}
                        onChange={(e) => set("payoutAccountId", e.target.value)}
                      >
                        <option value="">{c.form.payoutNone}</option>
                        {accounts
                          .filter(
                            (a) =>
                              a.id !== open.account?.id &&
                              a.productKind !== "time_deposit",
                          )
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                              {a.maskedNumber
                                ? ` · ${a.maskedNumber.slice(-4)}`
                                : ""}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <Seg
                    label={c.form.maturityInstruction}
                    value={s.maturityInstruction}
                    options={(["aro", "aro_plus", "non_aro"] as const).map(
                      (k) => [k, c.instructions[k], c.instructionHints[k]],
                    )}
                    onChange={(v) =>
                      set(
                        "maturityInstruction",
                        v as AccountFormState["maturityInstruction"],
                      )
                    }
                  />
                  {maturity && (
                    <div className="rkf-note rkf-note--lime rkf-note--grid">
                      <span>
                        {c.form.maturityLabel}
                        <b>{formatDay(maturity, locale)}</b>
                      </span>
                      {netPerTenor !== null && (
                        <span>
                          {c.form.netInterestLabel}
                          <b className="mono">{money.format(netPerTenor)}</b>
                        </span>
                      )}
                    </div>
                  )}
                  <p className="rkf-note rkf-note--warn">
                    {c.form.earlyWithdrawalNote}
                  </p>
                  <ToggleRow
                    label={c.form.reminder}
                    hint={c.form.reminderHint}
                    checked={s.maturityReminder}
                    onChange={(v) => set("maturityReminder", v)}
                  />
                </>
              )}
              {domestic ? (
                <p className="hint">
                  <b>{c.form.taxLine}.</b> {c.form.taxHint}
                  {!isEdit && ` ${c.form.balanceLockedNote}`}
                </p>
              ) : (
                <p className="hint">
                  {c.form.taxForeignHint}
                  {!isEdit && ` ${c.form.balanceLockedNote}`}
                </p>
              )}
              {exposure && exposure.total > 0 && (
                <InsuranceNote
                  insurer={exposure.insurer}
                  bank={s.bank}
                  holder={holderLabel}
                  total={exposure.total}
                  cap={exposure.capIdr}
                />
              )}
            </Section>

            {/* 5 — Access */}
            <Section n={5} title={c.form.secAccess}>
              {isMasterLike && (
                <ToggleRow
                  label={c.form.familyShared}
                  hint={
                    s.familyShared
                      ? c.form.familySharedHint
                      : fill(c.form.ownedBy, {
                          name:
                            holderMember?.name ??
                            members.find((m) => m.userId === myUserId)?.name ??
                            "—",
                        })
                  }
                  checked={s.familyShared}
                  onChange={(v) =>
                    setS((p) => ({ ...p, familyShared: v, ownerTouched: true }))
                  }
                />
              )}
              {isMasterLike && (
                <div className="field">
                  <span className="label">{c.form.sharedWith}</span>
                  {s.isPrivate ? (
                    <p className="hint">{c.form.sharedWithPrivate}</p>
                  ) : shareable.length === 0 ? (
                    <p className="hint">{c.form.sharedWithNone}</p>
                  ) : (
                    <ul className="rkf-people">
                      {shareable.map((m) => (
                        <li key={m.userId}>
                          <span className="rkf-av" aria-hidden="true">
                            {initials(m.name)}
                          </span>
                          <span className="rkf-person">{m.name}</span>
                          <select
                            className="select rkf-right"
                            aria-label={`${c.form.sharedWith} ${m.name}`}
                            value={s.shares[m.userId] ?? "none"}
                            onChange={(e) =>
                              setS((p) => ({
                                ...p,
                                shares: {
                                  ...p.shares,
                                  [m.userId]: e.target.value as ShareRight,
                                },
                              }))
                            }
                          >
                            <option value="none">
                              {c.form.shareRights.none}
                            </option>
                            <option value="view">
                              {c.form.shareRights.view}
                            </option>
                            <option value="post">
                              {c.form.shareRights.post}
                            </option>
                          </select>
                        </li>
                      ))}
                    </ul>
                  )}
                  <span className="hint block">{c.form.sharedWithHint}</span>
                </div>
              )}
              <ToggleRow
                label={c.form.privateLabel}
                hint={c.form.privateHint}
                checked={s.isPrivate}
                onChange={(v) => set("isPrivate", v)}
              />
              <Seg
                label={c.form.status}
                value={s.status}
                options={(
                  ["active", "dormant", "blocked", "closed"] as const
                ).map((k) => [k, c.statuses[k]])}
                onChange={(v) => set("status", v as AccountFormState["status"])}
              />
              {!domestic && (
                <ToggleRow
                  label={c.form.reportTax}
                  hint={c.form.reportTaxHint}
                  checked={s.reportInTaxReturn}
                  onChange={(v) => set("reportInTaxReturn", v)}
                />
              )}
              <button
                type="button"
                className="rkf-more"
                aria-expanded={showMore}
                onClick={() => setShowMore((v) => !v)}
              >
                <span>{c.form.moreDetails}</span>
                <small>{c.form.moreDetailsHint}</small>
              </button>
              {showMore && (
                <div className="rkf-more-body">
                  <TextField
                    label={c.form.branch}
                    value={s.branch}
                    onChange={(v) => set("branch", v)}
                  />
                  <ToggleRow
                    label={c.form.isPrimary}
                    hint={c.form.isPrimaryHint}
                    checked={s.isPrimary}
                    onChange={(v) => set("isPrimary", v)}
                  />
                  <div className="field">
                    <label className="label rkf-label" htmlFor={`${uid}-ben`}>
                      <span>{c.form.beneficiary}</span>
                      <em>{c.form.optional}</em>
                    </label>
                    <select
                      id={`${uid}-ben`}
                      className="select"
                      value={s.beneficiary}
                      onChange={(e) => set("beneficiary", e.target.value)}
                    >
                      <option value="">{c.form.beneficiaryNone}</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name}
                        </option>
                      ))}
                      <option value={OTHER}>{c.form.holderOther}</option>
                    </select>
                    {s.beneficiary === OTHER && (
                      <input
                        className="input mt-2"
                        aria-label={c.form.beneficiary}
                        value={s.beneficiaryName}
                        onChange={(e) => set("beneficiaryName", e.target.value)}
                      />
                    )}
                    <span className="hint block">{c.form.beneficiaryHint}</span>
                  </div>
                  <label className="field">
                    <span className="label">{c.form.notes}</span>
                    <textarea
                      className="textarea"
                      rows={3}
                      maxLength={1000}
                      value={s.notes}
                      onChange={(e) => set("notes", e.target.value)}
                    />
                  </label>
                </div>
              )}
            </Section>
          </div>

          <div className="wm-panel-foot">
            <PillButton type="button" onClick={onClose}>
              {c.form.cancel}
            </PillButton>
            <PillButton
              type="button"
              variant="primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? c.form.saving
                : deposit
                  ? c.form.saveDeposit
                  : c.form.save}
            </PillButton>
          </div>
        </div>
      </PanelContent>
    </Dialog>
  );
}

// ── Small building blocks ────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rkf-sec" aria-label={title}>
      <h3 className="rkf-sec-t">
        <i aria-hidden="true">{n}</i>
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Radio semantics for the segmented controls: one tab stop (the checked
 * option), arrow keys move and select, as a native radio group does.
 */
function radioKeys(
  e: KeyboardEvent<HTMLButtonElement>,
  values: readonly string[],
  current: string,
  onChange: (v: string) => void,
) {
  const step =
    e.key === "ArrowRight" || e.key === "ArrowDown"
      ? 1
      : e.key === "ArrowLeft" || e.key === "ArrowUp"
        ? -1
        : 0;
  if (!step) return;
  e.preventDefault();
  const i = Math.max(0, values.indexOf(current));
  const next = values[(i + step + values.length) % values.length];
  onChange(next);
  const group = e.currentTarget.parentElement;
  requestAnimationFrame(() =>
    group
      ?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(next)}"]`)
      ?.focus(),
  );
}

function Seg({
  label,
  value,
  options,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string, string?]>;
  onChange: (v: string) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="segmented rkf-seg" role="radiogroup" aria-label={label}>
        {options.map(([v, text, sub], i) => (
          <button
            key={v}
            type="button"
            role="radio"
            data-value={v}
            aria-checked={value === v}
            tabIndex={
              value === v || (i === 0 && !options.some(([o]) => o === value))
                ? 0
                : -1
            }
            disabled={disabled}
            className="segmented__item"
            onClick={() => onChange(v)}
            onKeyDown={(e) =>
              radioKeys(
                e,
                options.map(([o]) => o),
                value,
                onChange,
              )
            }
          >
            {text}
            {sub && <small>{sub}</small>}
          </button>
        ))}
      </div>
      {hint && <span className="hint block">{hint}</span>}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input
        className={mono ? "input mono" : "input"}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="rkf-toggle">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
        aria-label={label}
      />
      <label htmlFor={id}>
        <b>{label}</b>
        {hint && <span>{hint}</span>}
      </label>
    </div>
  );
}

function BalanceInput({
  id,
  row,
  ariaLabel,
  onChange,
}: {
  id: string;
  row: MoneyRow;
  ariaLabel: string;
  onChange: (next: MoneyRow) => void;
}) {
  const field = useControlledMoneyField({
    raw: row.raw,
    currency: row.currency,
    onChange: (next) => onChange(next),
  });
  return <MoneyInput field={field} id={id} ariaLabel={ariaLabel} />;
}

function InsuranceNote({
  insurer,
  bank,
  holder,
  total,
  cap,
}: {
  insurer: string;
  bank: string;
  holder: string;
  total: number;
  cap: number;
}) {
  const { t } = useLocale();
  const c = t.rekening.v3.form;
  const money = useMoney();
  const ratio = cap > 0 ? total / cap : 0;
  const over = total - cap;
  return (
    <div
      className={
        ratio > 1 ? "rkf-note rkf-note--warn" : "rkf-note rkf-note--lime"
      }
    >
      <b>{fill(c.insuranceTitle, { insurer })}</b>
      <span>
        {fill(c.insuranceBody, {
          bank,
          holder,
          total: money.format(total),
          cap: money.format(cap),
        })}
        {over > 0 && ` ${fill(c.insuranceOver, { over: money.format(over) })}`}
      </span>
      <span className="rkf-bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
      </span>
    </div>
  );
}
