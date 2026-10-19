"use client";
import { useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { INVESTMENT_PLATFORMS } from "@wealthme/contracts";
import type { AccountDto, PlatformAccountDto } from "@wealthme/contracts";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { PlatformForm } from "./platform-form";
import { PocketTransfer } from "./pocket-transfer";
import { money } from "./portfolio-model";
import type { PortfolioMember } from "./portfolio-filters";

export function PlatformFunds({
  platforms,
  accounts,
  members,
  fg,
  token,
  myUserId,
  isMaster,
  canManage,
  onSaved,
}: {
  platforms: PlatformAccountDto[];
  accounts: AccountDto[];
  members: PortfolioMember[];
  fg: string;
  token: string;
  myUserId: string;
  isMaster: boolean;
  canManage: boolean;
  onSaved: () => void;
}) {
  const { t, locale } = useLocale();
  const c = t.investasi.v3;
  const f = t.investasi.forms;
  const { hideBalance } = useMoney();
  const [form, setForm] = useState<{
    platform: PlatformAccountDto | null;
  } | null>(null);
  const [transfer, setTransfer] = useState<{
    pocketId: string;
    withdraw: boolean;
  } | null>(null);
  return (
    <section className="iv-card">
      <div className="iv-section-head">
        <h2>{c.funds}</h2>
        {canManage && (
          <button
            className="btn btn--primary"
            onClick={() => setForm({ platform: null })}
          >
            <Plus />
            {f.addPlatform}
          </button>
        )}
      </div>
      {!platforms.length && <p className="iv-empty">{c.noFunds}</p>}
      <div className="iv-platforms">
        {platforms.map((p) => {
          const catalog = INVESTMENT_PLATFORMS.find(
            (v) => v.key === p.platformKey,
          );
          return (
            <article key={p.id} className="iv-platform">
              <header className="iv-section-head">
                <div className="iv-instrument">
                  <span className="iv-instrument-mark" aria-hidden="true">
                    {catalog?.mark ?? "P"}
                  </span>
                  <div>
                    <h2>
                      {p.label ??
                        p.platformName ??
                        p.customName ??
                        p.platformKey}
                    </h2>
                    <small>
                      {p.ownerName ?? c.family} · {c.manual}
                    </small>
                  </div>
                </div>
                {canManage && (
                  <button
                    className="btn btn--outline"
                    onClick={() => setForm({ platform: p })}
                  >
                    <Plus />
                    {f.addPocket}
                  </button>
                )}
              </header>
              {!p.pockets?.length && <p className="iv-empty">{c.noFunds}</p>}
              {p.pockets?.map((pocket) => {
                const fmt = (value: string | null) =>
                  money(
                    value,
                    "IDR",
                    locale,
                    hideBalance || pocket.balancesHidden,
                  );
                return (
                  <div className="iv-pocket" key={pocket.id}>
                    <strong>
                      <Wallet />
                      {pocket.name} · {pocket.currency}
                    </strong>
                    <dl className="iv-pocket-balances">
                      <div>
                        <dt>{c.recorded}</dt>
                        <dd>{fmt(pocket.recordedBalance)}</dd>
                      </div>
                      <div>
                        <dt>{c.held}</dt>
                        <dd>{fmt(pocket.heldBalance)}</dd>
                      </div>
                      <div>
                        <dt>{c.available}</dt>
                        <dd>
                          {pocket.heldIncomplete
                            ? "—"
                            : fmt(pocket.availableBalance)}
                        </dd>
                      </div>
                    </dl>
                    {canManage &&
                      !pocket.balancesHidden &&
                      pocket.status !== "closed" && (
                        <div className="iv-tools">
                          <button
                            className="btn btn--primary"
                            onClick={() =>
                              setTransfer({
                                pocketId: pocket.id,
                                withdraw: false,
                              })
                            }
                          >
                            {c.topUp}
                          </button>
                          <button
                            className="btn btn--outline"
                            disabled={pocket.heldIncomplete}
                            onClick={() =>
                              setTransfer({
                                pocketId: pocket.id,
                                withdraw: true,
                              })
                            }
                          >
                            {f.withdraw}
                          </button>
                        </div>
                      )}
                  </div>
                );
              })}
            </article>
          );
        })}
      </div>
      {form && (
        <PlatformForm
          {...{ fg, token, members, myUserId, isMaster, onSaved }}
          platform={form.platform}
          onClose={() => setForm(null)}
        />
      )}
      {transfer && (
        <PocketTransfer
          {...{ fg, token, platforms, accounts, onSaved }}
          initialPocketId={transfer.pocketId}
          withdraw={transfer.withdraw}
          onClose={() => setTransfer(null)}
        />
      )}
    </section>
  );
}
