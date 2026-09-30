"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession, signOut } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { Users } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { id } from "@/i18n/id";

import type { Role } from "@wealthme/contracts";

// EPIC-026 Wave 7 — restyled to docs/prototype/pages/join-token.html's
// `.auth` shell (brand above a token card, `.btn` translations per
// EPIC-025-N3-translation-table.md). Per J1/H6, the prototype's tombstone
// content ("Undangan keluarga sudah tidak dipakai", the legacy-token
// warning, and the "Cara bergabung sekarang" steps) is NOT ported — the
// real accept-invite flow below still works, and replacing it would break
// pending invites. Accept logic is untouched.

type Invitation = {
  familyGroupName: string;
  email: string;
  // Typed as the shared `Role` union (not bare `string`) so the label lookup
  // below needs no cast and a new role forces a label — EPIC-023 Task C.
  role: Role;
  expiresAt: string;
};

export default function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: inviteToken } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const {
    data: invitation,
    isLoading,
    isError,
    error,
  } = useQuery<Invitation>({
    queryKey: ["invitation", inviteToken],
    queryFn: () =>
      apiFetch<Invitation>(`/family-groups/invitations/${inviteToken}`),
    retry: false,
  });

  async function handleAccept() {
    if (!session?.accessToken) return;
    setAccepting(true);
    try {
      await apiFetch(`/family-groups/invitations/${inviteToken}/accept`, {
        method: "POST",
        token: session.accessToken,
      });
      setAccepted(true);
      toast.success("Undangan diterima! Silakan masuk kembali.");
      // familyGroupId is stamped at session creation — re-login activates
      // the new group (session hook picks the newest membership).
      setTimeout(() => void signOut({ callbackUrl: "/login" }), 1500);
    } catch (e) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : "Gagal menerima undangan.";
      toast.error(msg);
      setAccepting(false);
    }
  }

  return (
    <AuthShell wide>
      <div className="au-panel au-center">
        <div className="au-tick">
          <Users size={26} aria-hidden="true" />
        </div>

        {isLoading && <p className="au-sub">Memuat undangan…</p>}

        {isError && (
          <>
            <h1 className="au-title">Undangan tidak valid</h1>
            <p className="au-sub" style={{ marginBottom: 0 }}>
              {error instanceof Error && error.message
                ? error.message
                : "Link undangan kedaluwarsa, sudah dipakai, atau tidak ditemukan."}
            </p>
          </>
        )}

        {invitation && !accepted && (
          <>
            <h1 className="au-title" style={{ fontSize: 16 }}>
              Undangan bergabung ke
              <br />
              &ldquo;{invitation.familyGroupName}&rdquo;
            </h1>
            <p className="au-sub">
              Untuk {invitation.email} · peran{" "}
              {id.common.roleLabels[invitation.role] ?? invitation.role}
            </p>

            {session?.accessToken ? (
              <button
                type="button"
                disabled={accepting}
                onClick={handleAccept}
                className="au-btn"
                data-variant="primary"
              >
                {accepting ? "Memproses…" : "Terima Undangan"}
              </button>
            ) : (
              <>
                <p className="au-sub">
                  Masuk atau daftar dulu, lalu buka link ini kembali.
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => router.push("/login")}
                    className="au-btn"
                    data-variant="primary"
                  >
                    Masuk
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/register")}
                    className="au-btn"
                  >
                    Daftar
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {accepted && (
          <>
            <h1 className="au-title" style={{ color: "var(--wm-good)" }}>
              Berhasil bergabung!
            </h1>
            <p className="au-sub" style={{ marginBottom: 0 }}>
              Mengalihkan ke halaman masuk…
            </p>
          </>
        )}
      </div>
    </AuthShell>
  );
}
