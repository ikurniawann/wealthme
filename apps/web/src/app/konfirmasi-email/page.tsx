"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, MailWarning } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
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
    <div className="au-panel au-center">
      {state.kind === "loading" && (
        <p className="au-sub" role="status">
          Mengonfirmasi email…
        </p>
      )}
      {state.kind === "done" && (
        <>
          <div className="au-tick">
            <CheckCircle2 size={26} aria-hidden="true" />
          </div>
          <h1 className="au-title">Email terkonfirmasi</h1>
          <p className="au-sub">
            Sekarang Anda bisa masuk dengan <strong>{state.email}</strong> (atau
            username keluarga Anda) dan memakai Lupa Password.
          </p>
        </>
      )}
      {state.kind === "error" && (
        <>
          <div className="au-tick" data-tone="warn">
            <MailWarning size={26} aria-hidden="true" />
          </div>
          <h1 className="au-title">Tidak bisa dikonfirmasi</h1>
          <p className="au-err" role="alert" style={{ marginBottom: 12 }}>
            {state.message}
          </p>
        </>
      )}
      <Link href="/login" className="au-btn">
        Ke halaman Login
      </Link>
    </div>
  );
}

export default function KonfirmasiEmailPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <Confirm />
      </Suspense>
    </AuthShell>
  );
}
