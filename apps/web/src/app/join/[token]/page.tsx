"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession, signOut } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";

type Invitation = {
  familyGroupName: string;
  email: string;
  role: string;
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[420px] rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent text-[26px]">
          👨‍👩‍👧‍👦
        </div>

        {isLoading && (
          <div className="text-[13px] text-muted-foreground">
            Memuat undangan…
          </div>
        )}

        {isError && (
          <>
            <div className="text-[17px] font-extrabold">
              Undangan tidak valid
            </div>
            <div className="mt-2 text-[13px] text-muted-foreground">
              {error instanceof Error && error.message
                ? error.message
                : "Link undangan kedaluwarsa, sudah dipakai, atau tidak ditemukan."}
            </div>
          </>
        )}

        {invitation && !accepted && (
          <>
            <div className="text-[17px] font-extrabold">
              Undangan bergabung ke
              <br />
              &ldquo;{invitation.familyGroupName}&rdquo;
            </div>
            <div className="mt-2 text-[13px] text-muted-foreground">
              Untuk {invitation.email} · peran {invitation.role}
            </div>

            {session?.accessToken ? (
              <button
                type="button"
                disabled={accepting}
                onClick={handleAccept}
                className="mt-6 w-full cursor-pointer rounded-lg bg-primary py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
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
                    className="cursor-pointer rounded-lg bg-primary py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-primary/90"
                  >
                    Masuk
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/register")}
                    className="cursor-pointer rounded-lg border py-2.5 text-[13.5px] font-bold transition-colors hover:bg-accent"
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
            <div className="text-[17px] font-extrabold text-success">
              Berhasil bergabung! 🎉
            </div>
            <div className="mt-2 text-[13px] text-muted-foreground">
              Mengalihkan ke halaman masuk…
            </div>
          </>
        )}
      </div>
    </div>
  );
}
