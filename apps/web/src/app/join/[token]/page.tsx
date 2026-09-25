"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession, signOut } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { SectionCard } from "@/components/wm";
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
    <div className="grid min-h-screen place-items-center bg-background px-4 py-6">
      <div className="w-full max-w-[440px]">
        <div className="mb-[18px] flex items-center justify-center gap-2.5">
          <div className="grid size-[34px] place-items-center rounded-[9px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed small brand mark, no responsive srcset needed */}
            <img
              src="/brand/wealthme-mark.png"
              alt=""
              className="size-full object-contain"
            />
          </div>
          <div className="text-[18px] font-extrabold tracking-tight">
            WealthMe
          </div>
        </div>

        <SectionCard bodyClassName="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent text-[26px]">
            👨‍👩‍👧‍👦
          </div>

          {isLoading && (
            <div className="text-[12.5px] text-muted-foreground">
              Memuat undangan…
            </div>
          )}

          {isError && (
            <>
              <div className="text-[16px] font-extrabold">
                Undangan tidak valid
              </div>
              <div className="mt-2 text-[12.5px] text-muted-foreground">
                {error instanceof Error && error.message
                  ? error.message
                  : "Link undangan kedaluwarsa, sudah dipakai, atau tidak ditemukan."}
              </div>
            </>
          )}

          {invitation && !accepted && (
            <>
              <div className="text-[16px] font-extrabold">
                Undangan bergabung ke
                <br />
                &ldquo;{invitation.familyGroupName}&rdquo;
              </div>
              <div className="mt-2 text-[12.5px] text-muted-foreground">
                Untuk {invitation.email} · peran{" "}
                {id.common.roleLabels[invitation.role] ?? invitation.role}
              </div>

              {session?.accessToken ? (
                <button
                  type="button"
                  disabled={accepting}
                  onClick={handleAccept}
                  className="mt-5 flex h-9 w-full cursor-pointer items-center justify-center gap-[7px] rounded-[9px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {accepting ? "Memproses…" : "Terima Undangan"}
                </button>
              ) : (
                <>
                  <div className="mt-4 text-[12.5px] text-muted-foreground">
                    Masuk atau daftar dulu, lalu buka link ini kembali.
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => router.push("/login")}
                      className="flex h-9 cursor-pointer items-center justify-center rounded-[9px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary-strong"
                    >
                      Masuk
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/register")}
                      className="flex h-9 cursor-pointer items-center justify-center rounded-[9px] border bg-card px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-secondary"
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
              <div className="text-[16px] font-extrabold text-success">
                Berhasil bergabung! 🎉
              </div>
              <div className="mt-2 text-[12.5px] text-muted-foreground">
                Mengalihkan ke halaman masuk…
              </div>
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
