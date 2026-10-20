"use client";

import { useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssetAttachmentDto } from "@wealthme/contracts";
import { apiFetch } from "@/lib/api-client";
import {
  openAssetDocument,
  uploadAssetDocument,
} from "@/lib/asset-attachments";
import { useLocale } from "@/hooks/use-locale";
import { fillCopy } from "../aset-model";

export function documentsKey(fg: string, assetId: string) {
  return ["assets", fg, assetId, "docs"] as const;
}

/** Dokumen tab — the asset's attachments (EPIC-033 p14), unchanged API. */
export function DocumentsCard({
  fg,
  token,
  assetId,
  canManage,
}: {
  fg: string;
  token: string | undefined;
  assetId: string;
  canManage: boolean;
}) {
  const { t, locale } = useLocale();
  const d = t.aset.v3.detail;
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const docs = useQuery<AssetAttachmentDto[]>({
    queryKey: documentsKey(fg, assetId),
    queryFn: () =>
      apiFetch<AssetAttachmentDto[]>(
        `/family-groups/${fg}/assets/${assetId}/attachments`,
        { token },
      ),
    enabled: Boolean(fg && token && assetId),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: documentsKey(fg, assetId) });
  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  async function upload(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      await uploadAssetDocument(fg, assetId, file, token);
      toast.success(d.docUploaded);
      await refresh();
    } catch {
      toast.error(d.docFailed);
    } finally {
      setUploading(false);
    }
  }
  async function remove(id: string) {
    try {
      await apiFetch(
        `/family-groups/${fg}/assets/${assetId}/attachments/${id}`,
        {
          method: "DELETE",
          token,
        },
      );
      toast.success(d.docDeleted);
      await refresh();
    } catch {
      toast.error(d.docFailed);
    }
  }

  const list = docs.data ?? [];
  return (
    <section className="ad-card ad-docs" aria-labelledby="ad-docs-title">
      <div className="ad-card-head">
        <h2 id="ad-docs-title">{d.docsTitle}</h2>
        <span className="ad-muted">
          {fillCopy(d.docsCount, { count: list.length })}
        </span>
        {canManage && (
          <label className="btn btn--outline ad-upload">
            <Upload aria-hidden="true" />
            {d.upload}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                void upload(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      {docs.isError ? (
        <p className="ad-empty" role="alert">
          {d.docFailed}
        </p>
      ) : list.length === 0 ? (
        <p className="ad-empty">{d.docsEmpty}</p>
      ) : (
        <ul className="ad-doclist">
          {list.map((doc) => (
            <li key={doc.id}>
              <button
                type="button"
                className="ad-doc-open"
                aria-label={`${d.openDoc}: ${doc.mimeType}`}
                onClick={() =>
                  void openAssetDocument(fg, assetId, doc.id, token)
                }
              >
                <FileText aria-hidden="true" />
                <span>
                  {doc.mimeType
                    .replace("image/", "")
                    .replace("application/", "")
                    .toUpperCase()}
                  {" · "}
                  {Math.max(1, Math.ceil(doc.size / 1024)).toLocaleString(
                    locale === "en" ? "en-US" : "id-ID",
                  )}{" "}
                  KB · {dateFmt.format(new Date(doc.createdAt))}
                </span>
              </button>
              {canManage && (
                <button
                  type="button"
                  className="ad-doc-del"
                  aria-label={d.deleteDoc}
                  title={d.deleteDoc}
                  onClick={() => void remove(doc.id)}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
