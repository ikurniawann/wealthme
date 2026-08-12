import { z } from "zod";

/**
 * EPIC-024 Task L (D15, US-TXN-9) — shared contract for transaction
 * attachments (receipts/photos). Mirrors
 * `apps/api/src/attachments/dto/transaction-attachment-response.dto.ts`
 * exactly: NO `filename`/`path` field — the storage key is an internal
 * detail, and the server never trusts a client-supplied filename (MIME is
 * sniffed server-side from the file's own bytes, not the client's
 * Content-Type). The UI derives a display label from `mimeType` alone.
 */
export const TransactionAttachmentDtoSchema = z.object({
  id: z.string().uuid(),
  transactionId: z.string().uuid(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type TransactionAttachmentDto = z.infer<
  typeof TransactionAttachmentDtoSchema
>;

/**
 * Client-side pre-check constants — MUST match the server's authoritative
 * limits (`attachments.controller.ts`'s `MAX_ATTACHMENT_FILE_BYTES`,
 * `attachments.service.ts`'s `detectAllowedMime`/`extensionForMime`). The
 * server is the source of truth; this only lets the UI reject an obviously
 * bad file before spending an upload round-trip.
 */
export const ATTACHMENT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export type AttachmentAcceptedMimeType =
  (typeof ATTACHMENT_ACCEPTED_MIME_TYPES)[number];
