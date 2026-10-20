import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import {
  detectAllowedMime,
  extensionForMime,
} from "../attachments/file-signature.util";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { StoragePort } from "../storage/storage.port";

import { parseDateOnly, ymd } from "./premium-schedule.util";

import type { InsuranceDocumentDto } from "@wealthme/contracts";

export const MAX_INSURANCE_DOCUMENT_BYTES = 5 * 1024 * 1024;
/** An upload writes its bytes moments before its row; never sweep those. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;
/** A storage folder name that can be a family id (no dots, no separators). */
const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;
/** Policy documents are PDF scans or photos; WEBP is not accepted here. */
const ACCEPTED_MIMES = new Set(["application/pdf", "image/jpeg", "image/png"]);

/**
 * Asuransi S8/S9 — uploaded policy documents and company reports. Sensitive
 * data: the bytes live behind StoragePort under a tenant-scoped key that is
 * never returned to the client; the type is sniffed from content (never the
 * client's Content-Type or file name); ≤ 5 MB. The controller has already
 * checked the viewer may see the policy (S9) — every query here is also
 * scoped by familyGroupId + insuranceId.
 */
@Injectable()
export class InsuranceDocumentsService {
  private readonly logger = new Logger(InsuranceDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StoragePort,
  ) {}

  private async assertPolicy(familyGroupId: string, insuranceId: string) {
    const p = await this.prisma.insurance.findUnique({
      where: { id: insuranceId, familyGroupId },
      select: { id: true },
    });
    if (!p) throw new NotFoundException("Insurance not found");
  }

  async create(
    familyGroupId: string,
    insuranceId: string,
    file: { buffer: Buffer; size: number; originalname?: string },
    opts: { reportDate?: string; actorUserId: string | null },
  ): Promise<InsuranceDocumentDto> {
    await this.assertPolicy(familyGroupId, insuranceId);
    if (file.size > MAX_INSURANCE_DOCUMENT_BYTES) {
      throw new BadRequestException("Ukuran file melebihi 5 MB");
    }
    const mime = detectAllowedMime(file.buffer);
    if (!mime || !ACCEPTED_MIMES.has(mime)) {
      throw new BadRequestException(
        "Jenis file tidak didukung — hanya PDF, JPG atau PNG",
      );
    }
    const key = `${familyGroupId}/insurances/${insuranceId}/${randomUUID()}.${extensionForMime(mime)}`;
    await this.storage.upload(key, file.buffer, mime);
    try {
      const row = await this.prisma.insuranceDocument.create({
        data: {
          insuranceId,
          familyGroupId,
          path: key,
          fileName: safeFileName(file.originalname, extensionForMime(mime)),
          mimeType: mime,
          size: file.size,
          reportDate: opts.reportDate ? parseDateOnly(opts.reportDate) : null,
          uploadedByUserId: opts.actorUserId,
        },
      });
      return toDocumentDto(row);
    } catch (err) {
      // No row → no orphaned sensitive bytes on disk.
      await this.storage.delete(key).catch(() => undefined);
      throw err;
    }
  }

  async list(
    familyGroupId: string,
    insuranceId: string,
  ): Promise<InsuranceDocumentDto[]> {
    await this.assertPolicy(familyGroupId, insuranceId);
    const rows = await this.prisma.insuranceDocument.findMany({
      where: { insuranceId, familyGroupId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDocumentDto);
  }

  async stream(familyGroupId: string, insuranceId: string, documentId: string) {
    const row = await this.find(familyGroupId, insuranceId, documentId);
    const stream = await this.storage.download(row.path);
    return {
      stream,
      mimeType: row.mimeType,
      size: row.size,
      fileName: row.fileName,
    };
  }

  /**
   * Deletes the stored object FIRST, then the row, so sensitive bytes are
   * never left behind by a row delete that succeeded. If the storage delete
   * fails, the row is still removed (the user asked for the document gone)
   * and the leftover object is logged and removed by `sweepOrphans`.
   * Value statements that cited the document keep their page + snippet
   * (documentId is set null by the FK).
   */
  async remove(
    familyGroupId: string,
    insuranceId: string,
    documentId: string,
  ): Promise<void> {
    const row = await this.find(familyGroupId, insuranceId, documentId);
    try {
      await this.storage.delete(row.path);
    } catch (err) {
      this.logger.error(
        `insurance document ${row.id}: storage delete failed, left for the orphan sweep: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    await this.prisma.insuranceDocument.delete({ where: { id: row.id } });
  }

  /**
   * Finds stored policy documents that no InsuranceDocument row points at —
   * rows cascaded away by a family delete or by the PREVIOUS image's
   * unguarded policy delete during a rollback, or a storage delete that
   * failed above.
   *
   * Safety (staging holds client files):
   * - DRY-RUN by default: logs the count and a sample of keys, deletes
   *   nothing. Deletes only when env `INSURANCE_ORPHAN_SWEEP=delete`.
   * - Strictly the `<fg>/insurances/` prefix; nothing else is ever listed
   *   below a family folder, and the family folder itself is never removed.
   * - No tree walk of the storage root: its immediate child folders are the
   *   family ids, then only `<fg>/insurances/` is listed.
   * - Objects of a family whose row is gone are candidates only after a
   *   direct `familyGroup.findUnique` confirms it is absent.
   * - Objects younger than `minAgeMs` are kept (an upload writes its bytes
   *   just before its row).
   */
  async sweepOrphans(
    opts: { mode?: "dry-run" | "delete"; minAgeMs?: number; now?: Date } = {},
  ): Promise<{
    mode: "dry-run" | "delete";
    candidates: string[];
    deleted: number;
  }> {
    const mode =
      opts.mode ??
      (process.env.INSURANCE_ORPHAN_SWEEP === "delete" ? "delete" : "dry-run");
    const minAgeMs = opts.minAgeMs ?? ORPHAN_MIN_AGE_MS;
    const now = opts.now ?? new Date();
    const candidates: string[] = [];

    for (const fg of await this.storage.listChildren("")) {
      if (!SAFE_SEGMENT.test(fg)) continue;
      const areas = await this.storage.listChildren(fg);
      if (!areas.includes("insurances")) continue;
      const prefix = `${fg}/insurances/`;
      const objects = (await this.storage.list(`${fg}/insurances`)).filter(
        (o) =>
          o.key.startsWith(prefix) &&
          now.getTime() - o.modifiedAt.getTime() >= minAgeMs,
      );
      if (objects.length === 0) continue;
      const family = await this.prisma.familyGroup.findUnique({
        where: { id: fg },
        select: { id: true },
      });
      if (!family) {
        // Family confirmed absent: every object under its insurance prefix
        // is unreferenced (its document rows cascaded with it).
        candidates.push(...objects.map((o) => o.key));
        continue;
      }
      const rows = await this.prisma.insuranceDocument.findMany({
        where: { path: { in: objects.map((o) => o.key) } },
        select: { path: true },
      });
      const referenced = new Set(rows.map((r) => r.path));
      candidates.push(
        ...objects.filter((o) => !referenced.has(o.key)).map((o) => o.key),
      );
    }

    if (candidates.length === 0) return { mode, candidates, deleted: 0 };
    const sample = candidates.slice(0, 10).join(", ");
    if (mode !== "delete") {
      this.logger.warn(
        `orphan sweep DRY-RUN: ${candidates.length} unreferenced insurance document object(s) would be deleted (set INSURANCE_ORPHAN_SWEEP=delete to delete). Sample: ${sample}`,
      );
      return { mode, candidates, deleted: 0 };
    }
    let deleted = 0;
    for (const key of candidates) {
      await this.storage.delete(key);
      deleted++;
    }
    this.logger.log(
      `orphan sweep deleted ${deleted} unreferenced insurance document object(s). Sample: ${sample}`,
    );
    return { mode, candidates, deleted };
  }

  /** The document, only when it belongs to this policy and family. */
  async find(familyGroupId: string, insuranceId: string, documentId: string) {
    const row = await this.prisma.insuranceDocument.findFirst({
      where: { id: documentId, insuranceId, familyGroupId },
    });
    if (!row) throw new NotFoundException("Dokumen tidak ditemukan");
    return row;
  }
}

/** Display name only (never a path): no separators/control chars, ≤ 255. */
function safeFileName(original: string | undefined, ext: string): string {
  const cleaned = (original ?? "")
    .replace(/[\\/]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255);
  return cleaned || `dokumen-polis.${ext}`;
}

export function toDocumentDto(row: {
  id: string;
  insuranceId: string;
  fileName: string;
  mimeType: string;
  size: number;
  reportDate: Date | null;
  createdAt: Date;
}): InsuranceDocumentDto {
  return {
    id: row.id,
    insuranceId: row.insuranceId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    size: row.size,
    reportDate: ymd(row.reportDate),
    createdAt: row.createdAt.toISOString(),
  };
}
