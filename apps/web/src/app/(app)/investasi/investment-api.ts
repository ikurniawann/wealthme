import { apiFetch } from "@/lib/api-client";
/** Keep structured ledger conflicts without changing the protected shared client. */
export async function investmentWrite<T = unknown>(
  path: string,
  options: {
    token: string;
    method: "POST" | "PATCH";
    body: string;
    timeoutMs?: number;
  },
): Promise<T> {
  const { token, method, body } = options;
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${path}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
      signal: AbortSignal.timeout(options.timeoutMs ?? 15000),
    },
  );
  if (response.status === 401) {
    return apiFetch<T>(path, { token, method, body });
  }
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw { ...details, status: response.status };
  }
  return response.json() as Promise<T>;
}

export async function uploadInvestmentProof(
  fg: string,
  transactionId: string,
  file: File,
  token: string,
): Promise<void> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/family-groups/${fg}/transactions/${transactionId}/attachments`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok) throw { status: response.status, message: "Upload failed" };
}

export async function uploadHoldingProof(
  fg: string,
  investmentId: string,
  file: File,
  token: string,
): Promise<void> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/family-groups/${fg}/investments/${investmentId}/attachments`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok) throw { status: response.status, message: "Upload failed" };
}
