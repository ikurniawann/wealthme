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

import type { AssetAttachmentResponseDto } from "./dto/asset-response.dto";

export const MAX_ASSET_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/**
 * EPIC-033 p14 — documents on a physical asset (sertifikat, BPKB, polis).
 * Mirrors AttachmentsService: sniffed mime, ≤5MB, tenant-scoped key, disk
 * or S3 through StoragePort.
 */
@Injectable()
export class AssetAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StoragePort,
  ) {}

  private async assertAsset(familyGroupId: string, assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId, familyGroupId },
      select: { id: true },
    });
    if (!asset) throw new NotFoundException("Asset not found");
  }

  async create(
    familyGroupId: string,
    assetId: string,
    file: { buffer: Buffer; size: number },
  ): Promise<AssetAttachmentResponseDto> {
    await this.assertAsset(familyGroupId, assetId);
    if (file.size > MAX_ASSET_ATTACHMENT_BYTES) {
      throw new BadRequestException("File exceeds 5MB");
    }
    const mime = detectAllowedMime(file.buffer);
    if (!mime) {
      throw new BadRequestException(
        "Unsupported file type, only JPG, PNG, WEBP, or PDF are allowed",
      );
    }
    const key = `${familyGroupId}/assets/${assetId}/${randomUUID()}.${extensionForMime(mime)}`;
    await this.storage.upload(key, file.buffer, mime);
    const row = await this.prisma.assetAttachment.create({
      data: {
        assetId,
        familyGroupId,
        path: key,
        mimeType: mime,
        size: file.size,
      },
    });
    return this.toDto(row);
  }

  async findAll(
    familyGroupId: string,
    assetId: string,
  ): Promise<AssetAttachmentResponseDto[]> {
    await this.assertAsset(familyGroupId, assetId);
    const rows = await this.prisma.assetAttachment.findMany({
      where: { assetId, familyGroupId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toDto(r));
  }

  async stream(familyGroupId: string, assetId: string, attachmentId: string) {
    const row = await this.prisma.assetAttachment.findFirst({
      where: { id: attachmentId, assetId, familyGroupId },
    });
    if (!row) throw new NotFoundException("Attachment not found");
    const stream = await this.storage.download(row.path);
    return { stream, mimeType: row.mimeType, size: row.size };
  }

  async remove(
    familyGroupId: string,
    assetId: string,
    attachmentId: string,
  ): Promise<void> {
    const row = await this.prisma.assetAttachment.findFirst({
      where: { id: attachmentId, assetId, familyGroupId },
    });
    if (!row) throw new NotFoundException("Attachment not found");
    await this.prisma.assetAttachment.delete({ where: { id: row.id } });
    await this.storage.delete(row.path);
  }

  private toDto(r: {
    id: string;
    assetId: string;
    mimeType: string;
    size: number;
    createdAt: Date;
  }): AssetAttachmentResponseDto {
    return {
      id: r.id,
      assetId: r.assetId,
      mimeType: r.mimeType,
      size: r.size,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
