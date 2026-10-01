"use client";

import type { AccessRoleResponse } from "@wealthme/contracts";

import { MEMBER_PASTELS } from "./access-shared";
import { scopeOf, type MemberRow } from "./members-tab";

type LimitedAccessCardProps = {
  members: MemberRow[];
  roles: AccessRoleResponse[];
};

/**
 * iam.html's right-column "tips" card — members whose data scope is "own"
 * (`alT`/`alP`/`limitedList`/`mosaic`), plus a small avatar mosaic showing
 * what share of the family has full access.
 */
export function LimitedAccessCard({ members, roles }: LimitedAccessCardProps) {
  const roleLabel = (role: string) => role;
  const limited = members.filter((m) => scopeOf(m, roles) === "own");
  const total = members.length;
  const fullAccessPct = total
    ? Math.round(((total - limited.length) / total) * 100)
    : 100;
  const litCount = Math.round((fullAccessPct / 100) * 18);

  return (
    <article className="card iam-tips">
      <div className="card__header">
        <div>
          <h2>
            {limited.length > 0
              ? `${limited.length} anggota akses terbatas`
              : "Semua anggota akses penuh"}
          </h2>
          <p className="text-muted-foreground">
            {limited.length > 0
              ? "Mereka hanya melihat transaksi milik sendiri."
              : "Setiap anggota bisa melihat seluruh data keluarga."}
          </p>
        </div>
      </div>
      <div className="card__body">
        {limited.length > 0 ? (
          <ul className="mini-list iam-limited-list">
            {limited.map((m, i) => {
              const pastel =
                MEMBER_PASTELS[i % MEMBER_PASTELS.length] ?? MEMBER_PASTELS[0]!;
              const initials = m.name
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase();
              return (
                <li key={m.id} className="iam-limited-row">
                  <span
                    className="avatar"
                    aria-hidden="true"
                    style={{ background: pastel.bg, color: pastel.fg }}
                  >
                    {initials}
                  </span>
                  <span>
                    <b className="block text-[13px]">{m.name}</b>
                    <small className="text-muted-foreground">
                      {m.accessRoleName ?? roleLabel(m.role)}
                    </small>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            Tidak ada anggota dengan akses terbatas.
          </p>
        )}
        <div className="iam-mosaic" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <i
              key={i}
              className={
                i < litCount
                  ? "iam-mosaic__cell iam-mosaic__cell--lit"
                  : i % 5 === 0
                    ? "iam-mosaic__cell iam-mosaic__cell--dim"
                    : "iam-mosaic__cell"
              }
            />
          ))}
        </div>
      </div>
    </article>
  );
}
