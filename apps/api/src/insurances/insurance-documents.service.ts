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
   * Deletes the row AND the stored object. Value statements that cited the
   * document keep their page + snippet (documentId is set null by the FK).
   */
  async remove(
    familyGroupId: string,
    insuranceId: string,
    documentId: string,
  ): Promise<void> {
    const row = await this.find(familyGroupId, insuranceId, documentId);
    await this.prisma.insuranceDocument.delete({ where: { id: row.id } });
    try {
      await this.storage.delete(row.path);
    } catch (err) {
      this.logger.error(
        `insurance document ${row.id}: row deleted but storage delete failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
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
