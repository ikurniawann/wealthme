"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, Info, WalletCards } from "lucide-react";
import { INVESTMENT_PLATFORMS, FX_CURRENCY_CODES } from "@wealthme/contracts";
import type {
  PlatformAccountDto,
  PlatformPocketDto,
} from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import type { PortfolioMember } from "./portfolio-filters";
import { Field } from "./investment-fields";
import { DialogSection, InvestDialogShell } from "./dialog-shell";
import { dialogCopy } from "./dialog-copy";

/** What a save created, so a caller (the top-up dialog) can select it. */
export interface PlatformFormResult {
  pocketId?: string;
}

/**
 * "Tambah akun platform" (platform + its first cash pocket) or, with a
 * platform, "Tambah kantong dana". Opened from the funds tab, the top-up
 * dialog and every pocket picker's empty state.
 */
export function PlatformForm({
  platform,
  fg,
  token,
  members,
  myUserId,
  isMaster,
  onClose,
  onSaved,
}: {
  platform: PlatformAccountDto | null;
  fg: string;
  token: string;
  members: PortfolioMember[];
  myUserId: string;
  isMaster: boolean;
  onClose: () => void;
  onSaved: (created?: PlatformFormResult) => void;
}) {
  const { t, locale } = useLocale();
  const copy = dialogCopy(locale);
  const c = t.investasi.v3;
  const f = t.investasi.forms;
  const [key, setKey] = useState(
    platform?.platformKey ?? INVESTMENT_PLATFORMS[0]!.key,
  );
  const [custom, setCustom] = useState("");
  const [label, setLabel] = useState("");
  const [ref, setRef] = useState("");
  const [owner, setOwner] = useState(myUserId);
  const catalog = INVESTMENT_PLATFORMS.find((p) => p.key === key);
  const [kind, setKind] = useState<string>(catalog?.pockets[0] ?? "general");
  const [currency, setCurrency] = useState(kind === "usd" ? "USD" : "IDR");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!platform && key === "custom" && !custom.trim()) {
      setError(f.required);
      return;
    }
    setBusy(true);
    setError("");
    let created: PlatformFormResult = {};
    try {
      const result = await apiFetch<PlatformAccountDto | PlatformPocketDto>(
        `/family-groups/${fg}/platform-accounts${platform ? `/${platform.id}/pockets` : ""}`,
        {
          token,
          method: "POST",
          body: JSON.stringify(
            platform
              ? {
                  pocketKind: kind,
                  currency,
                  name: label.trim() || undefined,
                  balance: 0,
                }
              : {
                  platformKey: key,
                  customName: key === "custom" ? custom.trim() : undefined,
                  label: label.trim() || undefined,
                  accountRef: ref.trim() || undefined,
                  ownerUserId: owner || undefined,
                  // A platform without a pocket is a dead end for top up /
                  // buy: create its first cash pocket in the same request.
                  pockets: [{ pocketKind: kind, currency, balance: 0 }],
                },
          ),
        },
      );
      created = {
        pocketId:
          "pockets" in result
            ? result.pockets?.[0]?.id
            : (result.id ?? undefined),
      };
    } catch (err) {
      setError(apiErrorMessage(err, f.failed));
      setBusy(false);
      return;
    }
    toast.success(f.saved);
    onSaved(created);
    onClose();
  }
  const pocketFields = (
    <div className="ivx-grid">
      {platform && (
        <Field label={f.pocketName} wide>
          {(id) => (
            <input
              id={id}
              className="input"
              maxLength={120}
              autoComplete="off"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          )}
        </Field>
      )}
      <Field label={f.pocketKind}>
        {(id) => (
          <select
            id={id}
            className="select"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setCurrency(e.target.value === "usd" ? "USD" : "IDR");
            }}
          >
            {(catalog?.pockets ?? ["general"]).map((k) => (
              <option key={k} value={k}>
                {f[k]}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field
        label={c.currency}
        hint={kind !== "general" ? copy.currencyLocked : undefined}
      >
        {(id) => (
          <select
            id={id}
            className="select"
            value={currency}
            disabled={kind !== "general"}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {FX_CURRENCY_CODES.map((cur) => (
              <option key={cur}>{cur}</option>
            ))}
          </select>
        )}
      </Field>
    </div>
  );
  return (
    <InvestDialogShell
      title={platform ? f.addPocket : f.addPlatform}
      subtitle={
        platform
          ? copy.pocketSub(
              platform.label ??
                platform.platformName ??
                platform.customName ??
                platform.platformKey,
            )
          : copy.platformSub
      }
      icon={platform ? <WalletCards /> : <Building2 />}
      busy={busy}
      submitLabel={f.save}
      onClose={onClose}
      onSubmit={save}
    >
      {!platform && (
        <DialogSection title={copy.platformSec}>
          <div className="ivx-grid">
            <Field label={c.platform}>
              {(id) => (
                <select
                  id={id}
                  className="select"
                  value={key}
                  onChange={(e) => {
                    setKey(e.target.value);
                    const cat = INVESTMENT_PLATFORMS.find(
                      (p) => p.key === e.target.value,
                    );
                    const first = cat?.pockets[0] ?? "general";
                    setKind(first);
                    setCurrency(first === "usd" ? "USD" : "IDR");
                  }}
                >
                  {INVESTMENT_PLATFORMS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {key === "custom" && (
              <Field label={f.customName} required>
                {(id) => (
                  <input
                    id={id}
                    className="input"
                    required
                    maxLength={120}
                    autoComplete="organization"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                  />
                )}
              </Field>
            )}
            <Field label={f.label} hint={copy.labelHint}>
              {(id) => (
                <input
                  id={id}
                  className="input"
                  maxLength={120}
                  autoComplete="off"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              )}
            </Field>
            <Field
              label={c.owner}
              hint={isMaster ? copy.ownerHint : copy.ownerLocked}
            >
              {(id) => (
                <select
                  id={id}
                  className="select"
                  disabled={!isMaster}
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                >
                  {isMaster && <option value="">{c.family}</option>}
                  {members.map((m) => (
                    <option value={m.userId} key={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={f.accountRef} hint={copy.refHint} wide>
              {(id) => (
                <input
                  id={id}
                  className="input mono"
                  maxLength={64}
                  autoComplete="off"
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                />
              )}
            </Field>
          </div>
        </DialogSection>
      )}
      <DialogSection title={platform ? copy.pocketSec : copy.firstPocketSec}>
        {pocketFields}
        <p className="ivx-strip">
          <Info aria-hidden="true" />
          {f.openingZero}
        </p>
      </DialogSection>
      {error && (
        <p className="error-text ivx-error" role="alert">
          {error}
        </p>
      )}
    </InvestDialogShell>
  );
}
