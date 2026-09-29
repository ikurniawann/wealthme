// Hardening batch G2 — tax document upload/open helpers, mirroring
// lib/asset-attachments.ts (a protected foundation file this task may not
// modify) exactly: multipart must bypass apiFetch's JSON Content-Type (the
// browser sets the boundary itself).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function uploadTaxDocument(
  familyGroupId: string,
  taxYear: number,
  file: File,
  token: string | undefined,
): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(
    `${API_URL}/family-groups/${familyGroupId}/tax/documents/${taxYear}`,
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
export async function openTaxDocument(
  familyGroupId: string,
  taxYear: number,
  documentId: string,
  token: string | undefined,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/family-groups/${familyGroupId}/tax/documents/${taxYear}/${documentId}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
  );
  if (!res.ok) throw new Error(res.statusText);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Fetches the CSV/PDF summary export and triggers a browser download. */
export async function downloadTaxSummary(
  familyGroupId: string,
  taxYear: number,
  format: "csv" | "pdf",
  token: string | undefined,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/family-groups/${familyGroupId}/tax/summary/${format}?year=${taxYear}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
  );
  if (!res.ok) throw new Error(res.statusText);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ringkasan-pajak-${taxYear}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
