"use client";

import { Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import type { AccessRoleResponse } from "@wealthme/contracts";

import { StatusBadge } from "@/components/wm";

import { SCOPE_COPY, summarizePermissions } from "./access-shared";

type RolesTabProps = {
  roles: AccessRoleResponse[] | undefined;
  isLoading: boolean;
  onCreate: () => void;
  onEdit: (role: AccessRoleResponse) => void;
  onDelete: (role: AccessRoleResponse) => void;
};

/** Reusable access bundles. Empty state explains why a Master would want one. */
export function RolesTab({
  roles,
  isLoading,
  onCreate,
  onEdit,
  onDelete,
}: RolesTabProps) {
  if (isLoading) {
    return <div className="card card__body t-muted">Memuat…</div>;
  }

  if (!roles || roles.length === 0) {
    return (
      <section className="card">
        <div className="card__body grid place-items-center gap-2 py-10 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-accent text-primary">
            <ShieldCheck size={22} aria-hidden="true" />
          </div>
          <h2 className="t-md">Belum ada role</h2>
          <p className="max-w-[440px] text-[12.5px] text-muted-foreground">
            Tanpa role, setiap anggota memakai akses bawaan sesuai tipenya
            (Anak, Staff, dst). Buat role bila beberapa anggota perlu akses yang
            sama — misalnya &quot;Supir&quot; yang hanya mencatat transaksi.
          </p>
          <button type="button" className="btn btn--primary" onClick={onCreate}>
            <Plus size={16} aria-hidden="true" />
            Buat Role Pertama
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="stack">
      <div className="row row--between row--wrap">
        <p className="text-[12.5px] text-muted-foreground">
          Mengubah role langsung berlaku untuk semua anggota yang memakainya.
        </p>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={onCreate}
        >
          <Plus size={15} aria-hidden="true" />
          Buat Role
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {roles.map((role) => (
          <article key={role.id} className="card">
            <div className="card__body stack" style={{ gap: 10 }}>
              <div
                className="row row--between"
                style={{ alignItems: "flex-start" }}
              >
                <div className="min-w-0">
                  <h3 className="t-md truncate">{role.name}</h3>
                  {role.description && (
                    <p className="t-sm text-muted-foreground">
                      {role.description}
                    </p>
                  )}
                </div>
                <StatusBadge
                  variant={role.dataScope === "own" ? "warning" : "info"}
                >
                  {SCOPE_COPY[role.dataScope].short}
                </StatusBadge>
              </div>
              <div
                className="row row--wrap t-sm text-muted-foreground"
                style={{ gap: 12 }}
              >
                <span>{summarizePermissions(role.permissions)}</span>
                <span className="row" style={{ gap: 4 }}>
                  <Users size={13} aria-hidden="true" />
                  {role.memberCount} anggota
                </span>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => onEdit(role)}
                >
                  <Pencil size={14} aria-hidden="true" />
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm text-destructive"
                  onClick={() => onDelete(role)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Hapus
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
