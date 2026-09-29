import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  Injectable,
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

import type { TaxDocumentResponseDto } from "./dto/tax-document-response.dto";

export const MAX_TAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

/**
 * Hardening batch G2 — documents supporting a family's annual tax filing
 * (bukti potong, NPWP, dsb). Mirrors AssetAttachmentsService exactly:
 * sniffed mime, ≤5MB, tenant-scoped key, disk or S3 through StoragePort.
 * Scoped by (familyGroupId, taxYear) rather than a TaxRecord FK so a
 * document can be uploaded before any TaxRecord row exists for that year.
 */
@Injectable()
export class TaxDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StoragePort,
  ) {}

  async create(
    familyGroupId: string,
    taxYear: number,
    file: { buffer: Buffer; size: number },
  ): Promise<TaxDocumentResponseDto> {
    if (file.size > MAX_TAX_DOCUMENT_BYTES) {
      throw new BadRequestException("File exceeds 5MB");
    }
    const mime = detectAllowedMime(file.buffer);
    if (!mime) {
      throw new BadRequestException(
        "Unsupported file type, only JPG, PNG, WEBP, or PDF are allowed",
      );
    }
    const key = `${familyGroupId}/tax/${taxYear}/${randomUUID()}.${extensionForMime(mime)}`;
    await this.storage.upload(key, file.buffer, mime);
    const row = await this.prisma.taxDocument.create({
      data: {
        familyGroupId,
        taxYear,
        path: key,
        mimeType: mime,
        size: file.size,
      },
    });
    return this.toDto(row);
  }

  async findAll(
    familyGroupId: string,
    taxYear: number,
  ): Promise<TaxDocumentResponseDto[]> {
    const rows = await this.prisma.taxDocument.findMany({
      where: { familyGroupId, taxYear },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toDto(r));
  }

  async stream(familyGroupId: string, taxYear: number, documentId: string) {
    const row = await this.prisma.taxDocument.findFirst({
      where: { id: documentId, familyGroupId, taxYear },
    });
    if (!row) throw new NotFoundException("Document not found");
    const stream = await this.storage.download(row.path);
    return { stream, mimeType: row.mimeType, size: row.size };
  }

  async remove(
    familyGroupId: string,
    taxYear: number,
    documentId: string,
  ): Promise<void> {
    const row = await this.prisma.taxDocument.findFirst({
      where: { id: documentId, familyGroupId, taxYear },
    });
    if (!row) throw new NotFoundException("Document not found");
    await this.prisma.taxDocument.delete({ where: { id: row.id } });
    await this.storage.delete(row.path);
  }

  private toDto(r: {
    id: string;
    taxYear: number;
    mimeType: string;
    size: number;
    createdAt: Date;
  }): TaxDocumentResponseDto {
    return {
      id: r.id,
      taxYear: r.taxYear,
      mimeType: r.mimeType,
      size: r.size,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
