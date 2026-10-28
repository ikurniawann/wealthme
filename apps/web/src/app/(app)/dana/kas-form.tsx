"use client";

import { SharedToggle } from "@/components/forms/shared-toggle";
import { useId, useState, type ReactNode } from "react";
import {
  Banknote,
  BarChart3,
  ChevronDown,
  FileText,
  Info,
  MapPin,
  Phone,
  User,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { AccountDto, FxCurrencyCode } from "@wealthme/contracts";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateField } from "@/components/wm";
import {
  MoneyInput,
  useControlledMoneyField,
  useFxSnapshot,
} from "@/components/money";
import { idrPreview, toCanonicalAmount } from "@/components/money/money-format";
import { useShell } from "@/components/shell/shell-context";
import { useLocale } from "@/hooks/use-locale";
import { CURRENCIES } from "@/hooks/currencies";
import { apiFetch } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { fill } from "@/i18n/rekening-v3";

import type { FormMember } from "../rekening/account-form";
import {
  buildKasBody,
  defaultWalletName,
  FAMILY_OWNER,
  initialKasState,
  OTHER_PROVIDER,
  todayIso,
  validateKas,
  type KasConverted,
  type KasErrors,
  type KasFormState,
  type KasKind,
} from "./kas-form-state";
import {
  findProvider,
  providersForCountry,
  walletCountry,
  WALLET_COUNTRIES,
  type WalletProvider,
} from "./wallet-directory";

export interface KasFormOpen {
  kind: KasKind;
  mode: "add" | "edit";
  account: AccountDto | null;
  preset?: { country?: string; provider?: string };
}

interface KasFormProps {
  open: KasFormOpen | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  members: readonly FormMember[];
  familyGroupId: string | undefined;
  token: string | undefined;
  myUserId: string | undefined;
  isMasterLike: boolean;
}

/** Error key → the id suffix of its control, in on-screen order. */
const FIELD_ID: Record<keyof KasErrors, string> = {
  provider: "prov",
  name: "name",
  identifier: "ident",
  owner: "owner",
  balance: "bal",
  date: "date",
};
const FIELD_ORDER = Object.keys(FIELD_ID) as (keyof KasErrors)[];

/** Kas & E-Wallet — the cash and e-wallet form (add and edit). */
export function KasForm(props: KasFormProps) {
  if (!props.open) return null;
  const key = `${props.open.kind}:${props.open.mode}:${props.open.account?.id ?? "new"}`;
  return <KasFormBody key={key} {...props} open={props.open} />;
}

function KasFormBody({
  open,
  onClose,
  onSaved,
  members,
  familyGroupId,
  token,
  myUserId,
  isMasterLike,
}: KasFormProps & { open: KasFormOpen }) {
  const { t, locale } = useLocale();
  const c = t.dana.v3.form;
  const { openTxnAt } = useShell();
  const uid = useId();
  const today = todayIso();
  const ctx = { myUserId, isMasterLike, today };
  const { kind, mode } = open;
  const isEdit = mode === "edit";
  const isWallet = kind === "ewallet";

  const [s, setS] = useState<KasFormState>(() =>
    initialKasState(kind, open.account, ctx, open.preset),
  );
  const [initialOwner] = useState(s.owner);
  const [errors, setErrors] = useState<KasErrors>({});
  const [saving, setSaving] = useState(false);
  const [showNotes, setShowNotes] = useState(() => !!open.account?.notes);

  const country = walletCountry(s.country);
  const providers = providersForCountry(s.country);
  const provider = findProvider(s.provider);
  const idKind = provider?.idKind ?? "id";

  const patch = (next: Partial<KasFormState>) =>
    setS((prev) => ({ ...prev, ...next }));

  const withDefaultName = (next: KasFormState): KasFormState =>
    isWallet && !next.nameTouched
      ? { ...next, name: defaultWalletName(next, c.walletNameSuffix) }
      : next;

  function changeCountry(code: string) {
    setS((prev) => {
      const next: KasFormState = {
        ...prev,
        country: code,
        currency: isEdit ? prev.currency : walletCountry(code).currency,
      };
      const keep =
        prev.provider === OTHER_PROVIDER ||
        !prev.provider ||
        providersForCountry(code).some((p) => p.key === prev.provider);
      return withDefaultName(keep ? next : { ...next, provider: "" });
    });
  }

  function changeProvider(value: string) {
    setS((prev) => withDefaultName({ ...prev, provider: value }));
  }

  // ── Members ─────────────────────────────────────────────────────────────
  const ownerId = s.owner === FAMILY_OWNER ? null : s.owner;
  const shareable = members.filter(
    (m) => m.dataScope === "own" && m.userId !== ownerId,
  );
  const sharedMembers = s.shares
    .map((id) => members.find((m) => m.userId === id))
    .filter((m): m is FormMember => !!m);
  const addable = shareable.filter((m) => !s.shares.includes(m.userId));

  function changeOwner(value: string) {
    setS((prev) => ({
      ...prev,
      owner: value,
      shares: prev.shares.filter((id) => id !== value),
    }));
  }

  // ── Money ───────────────────────────────────────────────────────────────
  const foreign = s.currency !== "IDR";
  const { data: rates, isLoading: ratesLoading } = useFxSnapshot(
    foreign && !isEdit,
  );
  // A foreign opening balance needs today's rate before it can be saved.
  const waitingForRate = foreign && !isEdit && ratesLoading;
  function convert(): KasConverted | null {
    const canonical = toCanonicalAmount(s.balanceRaw) ?? "0";
    if (!foreign)
      return { currency: s.currency, idr: Number(canonical), fxAmount: null };
    const preview = idrPreview(
      canonical,
      s.currency as FxCurrencyCode,
      rates,
      0,
    );
    return preview === null
      ? null
      : { currency: s.currency, idr: Number(preview), fxAmount: canonical };
  }

  async function handleSave() {
    const found = validateKas(kind, s, isEdit, c.walletNameSuffix);
    setErrors(found);
    const firstInvalid = FIELD_ORDER.find((k) => found[k]);
    if (firstInvalid) {
      document.getElementById(`${uid}-${FIELD_ID[firstInvalid]}`)?.focus();
      return;
    }
    if (!familyGroupId || !token) return;
    let converted: KasConverted | null = null;
    if (!isEdit) {
      converted = convert();
      if (!converted) {
        toast.error(c.rateMissing);
        return;
      }
    }
    setSaving(true);
    try {
      const body = buildKasBody(
        kind,
        s,
        ctx,
        mode,
        c.walletNameSuffix,
        converted,
        initialOwner,
      );
      const base = `/family-groups/${familyGroupId}/accounts`;
      if (isEdit && open.account) {
        await apiFetch(`${base}/${open.account.id}`, {
          token,
          method: "PATCH",
          body: JSON.stringify(body),
        });
        toast.success(c.updated);
      } else {
        await apiFetch(base, {
          token,
          method: "POST",
          body: JSON.stringify(body),
        });
        toast.success(isWallet ? c.savedWallet : c.savedCash);
      }
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, c.failed));
      setSaving(false);
      return;
    }
    // Saved: a failed list refresh must not read as a failed save.
    try {
      await onSaved();
    } catch {
      // the query refetches on its own; the account exists either way
    }
    setSaving(false);
    onClose();
  }

  const err = (key: keyof KasErrors) =>
    errors[key] ? (
      <span
        id={`${uid}-${FIELD_ID[key]}-err`}
        className="error-text block"
        role="alert"
      >
        {errors[key] === "negativeWallet" ? c.negativeWallet : c.required}
      </span>
    ) : null;

  const title = isEdit
    ? isWallet
      ? c.editWalletTitle
      : c.editCashTitle
    : isWallet
      ? c.addWalletTitle
      : c.addCashTitle;
  const subtitle = isWallet ? c.addWalletSub : c.addCashSub;
  const HeadIcon = isWallet ? Wallet : Banknote;

  const currencyNames = t.akun.pengaturan.currencies;
  const currencyOptions = CURRENCIES.some((x) => x.code === s.currency)
    ? CURRENCIES
    : [
        ...CURRENCIES,
        { code: s.currency as FxCurrencyCode, symbol: s.currency },
      ];
  // "Rp · Rupiah" → "Rupiah": the symbol already sits in the leading mark.
  const currencyLabel = (code: string) =>
    (currencyNames[code as keyof typeof currencyNames]?.name ?? code)
      .split(" · ")
      .pop() ?? code;
  const currencyMark =
    currencyOptions.find((x) => x.code === s.currency)?.symbol ?? s.currency;
  const idLabel =
    idKind === "phone"
      ? c.walletIdPhone
      : idKind === "email"
        ? c.walletIdEmail
        : c.walletIdOther;

  const nameField = (
    <Field
      id={`${uid}-name`}
      label={isWallet ? c.walletName : c.cashName}
      required
    >
      <input
        id={`${uid}-name`}
        className="input"
        value={s.name}
        placeholder={isWallet ? undefined : c.cashNamePh}
        aria-invalid={!!errors.name}
        aria-describedby={errors.name ? `${uid}-name-err` : undefined}
        onChange={(e) => patch({ name: e.target.value, nameTouched: true })}
      />
      {err("name")}
    </Field>
  );

  const countryField = (
    <Field id={`${uid}-country`} label={c.country}>
      <select
        id={`${uid}-country`}
        className="select"
        value={s.country}
        onChange={(e) => changeCountry(e.target.value)}
      >
        {WALLET_COUNTRIES.map((x) => (
          <option key={x.code} value={x.code}>
            {x.name[locale === "en" ? "en" : "id"]}
          </option>
        ))}
      </select>
    </Field>
  );

  const ownerField = (
    <Field id={`${uid}-owner`} label={c.owner} required>
      <Adorned icon={<User aria-hidden="true" />}>
        <select
          id={`${uid}-owner`}
          className="select"
          value={s.owner}
          disabled={!isMasterLike}
          aria-invalid={!!errors.owner}
          onChange={(e) => changeOwner(e.target.value)}
        >
          {s.owner === "" && <option value="" />}
          {members
            .filter((m) => isMasterLike || m.userId === myUserId)
            .map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          {isMasterLike && (
            <option value={FAMILY_OWNER}>{c.familyOwner}</option>
          )}
        </select>
      </Adorned>
      {err("owner")}
    </Field>
  );

  const currencyField = (
    <Field id={`${uid}-cur`} label={c.currency} required>
      <Adorned icon={<span className="kwf-mark">{currencyMark}</span>}>
        <select
          id={`${uid}-cur`}
          className="select"
          value={s.currency}
          disabled={isEdit}
          onChange={(e) => patch({ currency: e.target.value })}
        >
          {currencyOptions.map((x) => (
            <option key={x.code} value={x.code}>
              {x.code} — {currencyLabel(x.code)}
            </option>
          ))}
        </select>
      </Adorned>
    </Field>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="kwf">
        <header className="kwf-head wm-dark">
          <span className="kwf-head-ic" aria-hidden="true">
            <HeadIcon />
          </span>
          <div className="kwf-head-text">
            <DialogTitle className="kwf-title">{title}</DialogTitle>
            <DialogDescription className="kwf-sub">
              {subtitle}
            </DialogDescription>
          </div>
          <DialogClose className="kwf-x" aria-label={c.close}>
            <X aria-hidden="true" />
          </DialogClose>
        </header>

        <form
          className="kwf-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <div className="kwf-body">
            <Section title={isWallet ? c.secWallet : c.secCash}>
              {isWallet ? (
                <>
                  <div className="kwf-grid">
                    {countryField}
                    <Field id={`${uid}-prov`} label={c.provider} required>
                      <Adorned icon={<ProviderTile provider={provider} />}>
                        <select
                          id={`${uid}-prov`}
                          className="select"
                          value={s.provider}
                          aria-invalid={!!errors.provider}
                          onChange={(e) => changeProvider(e.target.value)}
                        >
                          <option value="" disabled>
                            {t.dana.v3.page.pickProvider}
                          </option>
                          {providers.map((p) => (
                            <option key={p.key} value={p.key}>
                              {p.name}
                            </option>
                          ))}
                          <option value={OTHER_PROVIDER}>
                            {t.dana.v3.page.otherProvider}
                          </option>
                        </select>
                      </Adorned>
                      {err("provider")}
                    </Field>
                  </div>
                  {s.provider === OTHER_PROVIDER && (
                    <Field
                      id={`${uid}-pcustom`}
                      label={c.providerCustom}
                      required
                    >
                      <input
                        id={`${uid}-pcustom`}
                        className="input"
                        placeholder={c.providerCustomPh}
                        value={s.providerCustom}
                        aria-invalid={!!errors.provider}
                        onChange={(e) =>
                          setS((p) =>
                            withDefaultName({
                              ...p,
                              providerCustom: e.target.value,
                            }),
                          )
                        }
                      />
                    </Field>
                  )}
                  <div className="kwf-grid">
                    {nameField}
                    <Field id={`${uid}-ident`} label={idLabel} required>
                      <div className="kwf-ident">
                        <span className="kwf-lead" aria-hidden="true">
                          {idKind === "phone" ? <Phone /> : <User />}
                          {idKind === "phone" && <b>{country.dial}</b>}
                        </span>
                        <input
                          id={`${uid}-ident`}
                          className="input"
                          inputMode={
                            idKind === "phone"
                              ? "tel"
                              : idKind === "email"
                                ? "email"
                                : "text"
                          }
                          autoComplete="off"
                          value={s.identifier}
                          aria-invalid={!!errors.identifier}
                          aria-describedby={
                            errors.identifier
                              ? `${uid}-ident-hint ${uid}-ident-err`
                              : `${uid}-ident-hint`
                          }
                          onChange={(e) =>
                            patch({ identifier: e.target.value })
                          }
                        />
                      </div>
                      {err("identifier")}
                    </Field>
                  </div>
                  {/* below the row, so "Nama dompet" and the ID input line up */}
                  <span
                    id={`${uid}-ident-hint`}
                    className="hint block kwf-row-hint"
                  >
                    {c.walletIdHint}
                  </span>
                  <div className="kwf-grid">
                    {ownerField}
                    {currencyField}
                  </div>
                </>
              ) : (
                <>
                  {nameField}
                  <div className="kwf-grid">
                    {ownerField}
                    {currencyField}
                  </div>
                  <div className="kwf-grid">
                    {countryField}
                    <Field
                      id={`${uid}-loc`}
                      label={
                        <>
                          {c.location} <em>{c.optional}</em>
                        </>
                      }
                    >
                      <Adorned icon={<MapPin aria-hidden="true" />}>
                        <input
                          id={`${uid}-loc`}
                          className="input"
                          placeholder={c.locationPh}
                          value={s.location}
                          onChange={(e) => patch({ location: e.target.value })}
                        />
                      </Adorned>
                    </Field>
                  </div>
                </>
              )}
            </Section>

            {!isEdit ? (
              <Section title={c.secOpening}>
                <div className="kwf-grid">
                  <Field id={`${uid}-bal`} label={c.balanceNow} required>
                    <BalanceInput
                      id={`${uid}-bal`}
                      invalid={!!errors.balance}
                      raw={s.balanceRaw}
                      currency={s.currency}
                      allowNegative={!isWallet}
                      ariaLabel={c.balanceNow}
                      onChange={(raw) => patch({ balanceRaw: raw })}
                    />
                    {err("balance")}
                  </Field>
                  <Field id={`${uid}-date`} label={c.balanceDate} required>
                    <DateField
                      id={`${uid}-date`}
                      value={s.date}
                      locale={locale}
                      label={c.balanceDate}
                      max={today}
                      required
                      onChange={(iso) => patch({ date: iso })}
                    />
                    {err("date")}
                  </Field>
                </div>
                <div className="kwf-note">
                  <Info aria-hidden="true" />
                  <p>
                    <b>{c.openingNote}</b>
                    <span>
                      {isWallet ? c.openingWalletHint : c.openingCashHint}{" "}
                      <button
                        type="button"
                        className="kwf-link"
                        onClick={() => {
                          onClose();
                          openTxnAt(2);
                        }}
                      >
                        {c.transferLink}
                      </button>
                      .
                    </span>
                  </p>
                </div>
              </Section>
            ) : (
              <div className="kwf-note">
                <Info aria-hidden="true" />
                <p>{c.balanceLocked}</p>
              </div>
            )}

            <Section title={c.secAccess}>
              <SharedToggle
                checked={!s.isPrivate}
                onChange={(shared) => patch({ isPrivate: !shared })}
              />
              {isMasterLike && !s.isPrivate && (
                <Field
                  id={`${uid}-share`}
                  label={
                    <>
                      {c.sharedWith} <em>{c.optional}</em>
                    </>
                  }
                >
                  <div className="kwf-share">
                    {sharedMembers.map((m) => (
                      <span key={m.userId} className="kwf-chip">
                        <span className="kwf-avatar" aria-hidden="true">
                          {m.name.slice(0, 1).toUpperCase()}
                        </span>
                        {m.name}
                        <button
                          type="button"
                          aria-label={fill(c.removeShare, { name: m.name })}
                          onClick={() =>
                            patch({
                              shares: s.shares.filter((id) => id !== m.userId),
                            })
                          }
                        >
                          <X aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                    <select
                      id={`${uid}-share`}
                      className="select kwf-share-pick"
                      value=""
                      disabled={addable.length === 0}
                      onChange={(e) =>
                        e.target.value &&
                        patch({ shares: [...s.shares, e.target.value] })
                      }
                    >
                      <option value="">
                        {addable.length === 0 && sharedMembers.length === 0
                          ? c.noShareable
                          : c.sharedPh}
                      </option>
                      {addable.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="hint block">{c.sharedHint}</span>
                </Field>
              )}

              <label className="kwf-check">
                <input
                  type="checkbox"
                  checked={s.includeInNetWorth}
                  onChange={(e) =>
                    patch({ includeInNetWorth: e.target.checked })
                  }
                />
                <span className="kwf-check-box" aria-hidden="true" />
                <span>
                  <b>{c.includeNetWorth}</b>
                  <small>
                    {isWallet ? c.includeWalletHint : c.includeCashHint}
                  </small>
                </span>
              </label>

              {isWallet ? (
                <p className="kwf-strip">
                  <BarChart3 aria-hidden="true" />
                  {c.manualNote}
                </p>
              ) : (
                <div className="kwf-more">
                  <button
                    type="button"
                    className="kwf-more-btn"
                    aria-expanded={showNotes}
                    aria-controls={`${uid}-notes`}
                    onClick={() => setShowNotes((v) => !v)}
                  >
                    <FileText aria-hidden="true" />
                    <span>
                      {c.notes} <em>{c.optional}</em>
                    </span>
                    <ChevronDown aria-hidden="true" data-open={showNotes} />
                  </button>
                  {showNotes && (
                    <textarea
                      id={`${uid}-notes`}
                      className="input kwf-notes"
                      rows={3}
                      aria-label={c.notes}
                      value={s.notes}
                      onChange={(e) => patch({ notes: e.target.value })}
                    />
                  )}
                </div>
              )}
            </Section>
          </div>

          <footer className="kwf-foot">
            <button
              type="button"
              className="btn btn--outline kwf-cancel"
              onClick={onClose}
            >
              {c.cancel}
            </button>
            <button
              type="submit"
              className="btn btn--primary kwf-save"
              disabled={saving || waitingForRate}
              aria-busy={waitingForRate || undefined}
            >
              {saving ? c.saving : isWallet ? c.saveWallet : c.saveCash}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="kwf-sec">
      <h3 className="kwf-sec-title">
        <span>{title}</span>
      </h3>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: ReactNode;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="field kwf-field">
      <label className="label" htmlFor={id}>
        {label}
        {required && (
          <span className="kwf-req" aria-hidden="true">
            {" *"}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

/** A control with a leading icon or tile inside its left edge. */
function Adorned({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="kwf-adorn">
      <span className="kwf-adorn-ic" aria-hidden="true">
        {icon}
      </span>
      {children}
    </div>
  );
}

function ProviderTile({ provider }: { provider: WalletProvider | undefined }) {
  if (!provider) return <Wallet className="kwf-tile-empty" />;
  return (
    <span className="kwf-tile" style={{ background: provider.color }}>
      {provider.mark}
    </span>
  );
}

function BalanceInput({
  id,
  invalid,
  raw,
  currency,
  allowNegative,
  ariaLabel,
  onChange,
}: {
  id: string;
  invalid: boolean;
  raw: string;
  currency: string;
  allowNegative: boolean;
  ariaLabel: string;
  onChange: (raw: string) => void;
}) {
  const field = useControlledMoneyField({
    raw,
    currency: currency as FxCurrencyCode,
    allowNegative,
    onChange: (next) => onChange(next.raw),
  });
  // The currency is chosen in the "Mata uang" field; the input only shows it.
  return (
    <div className="kwf-bal" data-invalid={invalid || undefined}>
      <MoneyInput
        field={field}
        id={id}
        ariaLabel={ariaLabel}
        ariaDescribedBy={invalid ? `${id}-err` : undefined}
      />
    </div>
  );
}
