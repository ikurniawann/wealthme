"use client";

import { useState } from "react";
import { Info, Plus } from "lucide-react";

import { useLocale } from "@/hooks/use-locale";
import { fill } from "@/i18n/rekening-v3";

import { BrandTile } from "./kas-brand";
import type { KasFormOpen } from "./kas-form";
import {
  providersForCountry,
  walletCountry,
  WALLET_COUNTRIES,
} from "./wallet-directory";

export function KasSidePanel({
  canManage,
  onOpen,
}: {
  canManage: boolean;
  onOpen: (open: KasFormOpen) => void;
}) {
  const { t, locale } = useLocale();
  const c = t.dana.v3.page;
  const [country, setCountry] = useState("ID");
  const [kind, setKind] = useState<"ewallet" | "cash">("ewallet");
  const [q, setQ] = useState("");

  const cur = walletCountry(country);
  const needle = q.trim().toLowerCase();
  const providers = providersForCountry(country).filter(
    (p) => !needle || p.name.toLowerCase().includes(needle),
  );
  const open = (preset: { country: string; provider?: string }, k = kind) =>
    onOpen({ kind: k, mode: "add", account: null, preset });

  return (
    <aside className="kw-card kw-side" aria-labelledby="kw-side-title">
      <h2 id="kw-side-title" className="kw-h2">
        {c.sideTitle}
      </h2>
      <p className="kw-side-sub">{c.sideSub}</p>
      <label className="kw-field">
        <span className="kw-sr">{c.country}</span>
        <span className="kw-code" aria-hidden="true">
          {cur.code}
        </span>
        <select
          className="kw-select kw-select-full kw-select-code"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          {WALLET_COUNTRIES.map((w) => (
            <option key={w.code} value={w.code}>
              {w.name[locale]}
            </option>
          ))}
        </select>
      </label>
      <label className="kw-field">
        <span className="kw-sr">{c.addAccount}</span>
        <select
          className="kw-select kw-select-full"
          value={kind}
          onChange={(e) => setKind(e.target.value as "ewallet" | "cash")}
        >
          <option value="ewallet">{c.addEwallet}</option>
          <option value="cash">{c.addCash}</option>
        </select>
      </label>

      {kind === "cash" ? (
        <div className="kw-side-cash">
          <p>{c.cashSideBody}</p>
          {canManage && (
            <button
              type="button"
              className="kw-btn"
              data-primary=""
              onClick={() => open({ country })}
            >
              <Plus aria-hidden="true" />
              {fill(c.addCashHere, { cur: cur.currency })}
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="kw-side-h">{c.pickProvider}</p>
          <input
            type="search"
            className="kw-side-search"
            placeholder={c.searchProvider}
            aria-label={c.searchProvider}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul className="kw-prov">
            {providers.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => open({ country, provider: p.key })}
                >
                  <BrandTile provider={p} size="sm" />
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
          {canManage && (
            <button
              type="button"
              className="kw-link kw-other"
              onClick={() => open({ country })}
            >
              <Plus aria-hidden="true" /> {c.otherProvider}
            </button>
          )}
          <p className="kw-side-note">{c.providerNote}</p>
        </>
      )}
      <p className="kw-info">
        <Info aria-hidden="true" /> {c.manualNote}
      </p>
    </aside>
  );
}
