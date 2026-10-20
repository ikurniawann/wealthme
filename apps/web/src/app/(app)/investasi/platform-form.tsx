"use client";
import { useState } from "react";
import { toast } from "sonner";
import { INVESTMENT_PLATFORMS, FX_CURRENCY_CODES } from "@wealthme/contracts";
import type {
  PlatformAccountDto,
  PlatformPocketDto,
} from "@wealthme/contracts";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import type { PortfolioMember } from "./portfolio-filters";
import { pocketTransferCopy } from "./pocket-transfer-copy";
import "./pocket-transfer.css";

/** What a save created, so a caller (the top-up dialog) can select it. */
export interface PlatformFormResult {
  pocketId?: string;
}

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
  const copy = pocketTransferCopy(locale);
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
  // New platform: the account label belongs with the platform fields, above
  // the first-pocket section. Add pocket: it names the pocket.
  const labelField = (
    <label className="field">
      <span className="label">{platform ? f.pocketName : f.label}</span>
      <input
        className="input"
        maxLength={120}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
    </label>
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="iv-dialog">
        <form onSubmit={save}>
          <header className="iv-dialog-head wm-dark">
            <DialogTitle>{platform ? f.addPocket : f.addPlatform}</DialogTitle>
            <DialogDescription>{c.manual}</DialogDescription>
          </header>
          <div className="iv-form-body">
            {!platform ? (
              <>
                <label className="field">
                  <span className="label">{c.platform}</span>
                  <select
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
                </label>
                {key === "custom" && (
                  <label className="field">
                    <span className="label">{f.customName} *</span>
                    <input
                      className="input"
                      required
                      maxLength={120}
                      value={custom}
                      onChange={(e) => setCustom(e.target.value)}
                    />
                  </label>
                )}
                <label className="field">
                  <span className="label">{c.owner}</span>
                  <select
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
                </label>
                <label className="field">
                  <span className="label">{f.accountRef}</span>
                  <input
                    className="input"
                    maxLength={64}
                    value={ref}
                    onChange={(e) => setRef(e.target.value)}
                  />
                </label>
              </>
            ) : null}
            {labelField}
            <>
              {!platform && (
                <h3 className="iv-pt-subhead">{copy.firstPocket}</h3>
              )}
              <label className="field">
                <span className="label">{f.pocketKind}</span>
                <select
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
              </label>
              <label className="field">
                <span className="label">{c.currency}</span>
                <select
                  className="select"
                  value={currency}
                  disabled={kind !== "general"}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {FX_CURRENCY_CODES.map((cur) => (
                    <option key={cur}>{cur}</option>
                  ))}
                </select>
              </label>
              <p className="iv-notice">{f.openingZero}</p>
            </>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="iv-form-footer">
            <button
              type="button"
              className="btn btn--outline"
              disabled={busy}
              onClick={onClose}
            >
              {f.cancel}
            </button>
            <button className="btn btn--primary" disabled={busy}>
              {busy ? f.saving : f.save}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
