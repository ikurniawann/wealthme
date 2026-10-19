"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { uploadHoldingProof } from "../investment-api";
interface Document {
  id: string;
  mimeType: string;
  size: number;
  createdAt: string;
}
export function DetailDocuments({
  id,
  fg,
  token,
  canManage,
}: {
  id: string;
  fg: string;
  token: string;
  canManage: boolean;
}) {
  const { t, locale } = useLocale();
  const d = t.investasi.detail;
  const f = t.investasi.forms;
  const c = t.investasi.v3;
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const base = `/family-groups/${fg}/investments/${id}/attachments`;
  const docs = useQuery({
    queryKey: ["investment-documents", fg, token, id],
    queryFn: () => apiFetch<Document[]>(base, { token }),
  });
  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!file || busy) return;
    if (file.size > 5 * 1024 * 1024) {
      setError(f.proofLimit);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await uploadHoldingProof(fg, id, file, token);
      setFile(null);
      form.reset();
      await docs.refetch();
      toast.success(d.documentSaved);
    } catch (err) {
      setError(apiErrorMessage(err, f.failed));
    } finally {
      setBusy(false);
    }
  }
  async function download(doc: Document) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${base}/${doc.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!response.ok) throw { status: response.status };
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${doc.id}.${doc.mimeType === "application/pdf" ? "pdf" : doc.mimeType.split("/")[1]}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(apiErrorMessage(err, f.failed));
    } finally {
      setBusy(false);
    }
  }
  async function remove(doc: Document) {
    setBusy(true);
    setError("");
    try {
      await apiFetch(`${base}/${doc.id}`, { token, method: "DELETE" });
      await docs.refetch();
      toast.success(d.documentDeleted);
    } catch (err) {
      setError(apiErrorMessage(err, f.failed));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="iv-card">
      <h2>{d.documents}</h2>
      {canManage && (
        <form onSubmit={upload} className="iv-document-upload">
          <label className="field">
            <span className="label">{d.upload}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={busy}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <small>{f.proofLimit}</small>
          </label>
          <button className="btn btn--primary" disabled={!file || busy}>
            {busy ? f.saving : d.upload}
          </button>
        </form>
      )}
      {docs.isPending ? (
        <p role="status">{c.loading}</p>
      ) : docs.isError ? (
        <p role="alert">{c.error}</p>
      ) : !docs.data.length ? (
        <p className="iv-empty">{d.noDocuments}</p>
      ) : (
        <ul className="iv-documents">
          {docs.data.map((doc) => (
            <li key={doc.id}>
              <span>
                {doc.mimeType} · {Math.ceil(doc.size / 1024)} KB ·{" "}
                {new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
                  dateStyle: "medium",
                  timeZone: "Asia/Jakarta",
                }).format(new Date(doc.createdAt))}
              </span>
              <div className="iv-row-actions">
                <button
                  className="btn btn--outline"
                  disabled={busy}
                  onClick={() => void download(doc)}
                >
                  {d.download}
                </button>
                {canManage && (
                  <button
                    className="btn btn--outline"
                    disabled={busy}
                    onClick={() => void remove(doc)}
                  >
                    {d.delete}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </section>
  );
}
