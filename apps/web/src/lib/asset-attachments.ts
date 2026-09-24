// EPIC-033 p14 — asset document upload/open helpers. Multipart must bypass
// `apiFetch`'s JSON Content-Type (the browser sets the boundary itself), same
// reasoning as the transaction receipt upload in transaction-dialog.tsx.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function uploadAssetDocument(
  familyGroupId: string,
  assetId: string,
  file: File,
  token: string | undefined,
): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(
    `${API_URL}/family-groups/${familyGroupId}/assets/${assetId}/attachments`,
    {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw { status: res.status, message: body.message ?? res.statusText };
  }
}

/** Fetches the bytes with the bearer token and opens them in a new tab. */
export async function openAssetDocument(
  familyGroupId: string,
  assetId: string,
  attachmentId: string,
  token: string | undefined,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/family-groups/${familyGroupId}/assets/${assetId}/attachments/${attachmentId}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
  );
  if (!res.ok) throw new Error(res.statusText);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
