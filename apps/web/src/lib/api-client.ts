// Authenticated fetch wrapper — attaches Bearer token from the session,
// retries once after a 401 by signing out (token rotation is handled by Auth.js).

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ApiError = {
  status: number;
  message: string;
};

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string },
): Promise<T> {
  const { token, ...rest } = options ?? {};
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...rest.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw {
      status: res.status,
      message: body.message ?? res.statusText,
    } satisfies ApiError;
  }

  // 204 No Content (every DELETE endpoint in this API) has no body — calling
  // res.json() on it throws a SyntaxError, which callers then swallow as a
  // generic "gagal menghapus" error even though the delete already succeeded,
  // and skip the invalidateQueries call that would refresh the UI.
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
