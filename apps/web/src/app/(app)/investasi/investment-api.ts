import { apiFetch } from "@/lib/api-client";
/** Keep structured ledger conflicts without changing the protected shared client. */
export async function investmentWrite(
  path: string,
  options: { token: string; method: "POST" | "PATCH"; body: string },
): Promise<void> {
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
      signal: AbortSignal.timeout(15000),
    },
  );
  if (response.status === 401) {
    await apiFetch(path, { token, method, body });
    return;
  }
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw { ...details, status: response.status };
  }
}
