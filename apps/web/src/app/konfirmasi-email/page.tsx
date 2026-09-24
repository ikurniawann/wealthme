"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, MailWarning } from "lucide-react";

import { SectionCard } from "@/components/wm";
import { apiFetch } from "@/lib/api-client";

/**
 * EPIC-031 — the link a Master-entered email receives. Confirming proves the
 * mailbox owner agrees; only then does the address become the member's login
 * email (sign-in + Lupa Password). Public route: the member may not be
 * signed in on this device.
 */
type State =
  | { kind: "loading" }
  | { kind: "done"; email: string }
  | { kind: "error"; message: string };

function Confirm() {
  const token = useSearchParams().get("token");
  // Single-use token: keyed on the token, never retried or refetched, so it
  // is sent exactly once even under strict-mode double rendering.
  const confirm = useQuery<{ email: string }, { message?: string }>({
    queryKey: ["member-email-confirm", token],
    queryFn: () =>
      apiFetch<{ email: string }>("/family-groups/member-email/confirm", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const state: State = !token
    ? { kind: "error", message: "Link tidak lengkap." }
    : confirm.isSuccess
      ? { kind: "done", email: confirm.data.email }
      : confirm.isError
        ? {
            kind: "error",
            message:
              confirm.error.message ?? "Konfirmasi gagal. Coba lagi nanti.",
          }
        : { kind: "loading" };

  return (
    <SectionCard>
      <div className="grid place-items-center gap-2 px-5 py-6 text-center">
        {state.kind === "loading" && (
          <div className="text-[13px] text-muted-foreground">
            Mengonfirmasi email…
          </div>
        )}
        {state.kind === "done" && (
          <>
            <div className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
              <CheckCircle2 className="size-[26px]" aria-hidden="true" />
            </div>
            <h1 className="text-[16px] font-extrabold">Email terkonfirmasi</h1>
            <p className="text-[12.5px] text-muted-foreground">
              Sekarang Anda bisa masuk dengan <strong>{state.email}</strong>{" "}
              (atau username keluarga Anda) dan memakai Lupa Password.
            </p>
          </>
        )}
        {state.kind === "error" && (
          <>
            <div className="grid size-16 place-items-center rounded-full bg-warning-soft text-warning">
              <MailWarning className="size-[26px]" aria-hidden="true" />
            </div>
            <h1 className="text-[16px] font-extrabold">
              Tidak bisa dikonfirmasi
            </h1>
            <p className="text-[12.5px] text-muted-foreground" role="alert">
              {state.message}
            </p>
          </>
        )}
      </div>
      <Link
        href="/login"
        className="flex h-9 w-full items-center justify-center rounded-[9px] border bg-card px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-secondary"
      >
        Ke halaman Login
      </Link>
    </SectionCard>
  );
}

export default function KonfirmasiEmailPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-[18px] flex items-center justify-center gap-2.5">
          <div className="gradient-wealth grid size-[34px] place-items-center rounded-[9px] text-[15px] font-extrabold text-white">
            W
          </div>
          <div className="text-[18px] font-extrabold tracking-tight">
            WealthMe
          </div>
        </div>
        <Suspense fallback={null}>
          <Confirm />
        </Suspense>
      </div>
    </div>
  );
}
