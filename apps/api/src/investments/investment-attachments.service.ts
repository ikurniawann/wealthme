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

import { investmentAccessWhere } from "./investment-access";

import type { LedgerActor } from "./ledger/ledger-support";
export interface InvestmentDocumentDto {
  id: string;
  investmentId: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export const MAX_INVESTMENT_ATTACHMENT_BYTES = 5 * 1024 * 1024;

@Injectable()
export class InvestmentAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StoragePort,
  ) {}

  private async assertInvestment(
    familyGroupId: string,
    investmentId: string,
    actor: LedgerActor,
    write = false,
  ) {
    const asset = await this.prisma.investment.findFirst({
      where: {
        id: investmentId,
        familyGroupId,
        AND: [investmentAccessWhere(actor, write)],
      },
      select: { id: true },
    });
    if (!asset) throw new NotFoundException("Investment not found");
  }

  async create(
    familyGroupId: string,
    investmentId: string,
    file: { buffer: Buffer; size: number },
    actor: LedgerActor,
  ): Promise<InvestmentDocumentDto> {
    await this.assertInvestment(familyGroupId, investmentId, actor, true);
    if (file.size > MAX_INVESTMENT_ATTACHMENT_BYTES) {
      throw new BadRequestException("File exceeds 5MB");
    }
    const mime = detectAllowedMime(file.buffer);
    if (!mime) {
      throw new BadRequestException(
        "Unsupported file type, only JPG, PNG, WEBP, or PDF are allowed",
      );
    }
    const key = `${familyGroupId}/investments/${investmentId}/${randomUUID()}.${extensionForMime(mime)}`;
    await this.storage.upload(key, file.buffer, mime);
    try {
      const row = await this.prisma.investmentAttachment.create({
        data: {
          investmentId,
          familyGroupId,
          path: key,
          mimeType: mime,
          size: file.size,
        },
      });
      return this.toDto(row);
    } catch (error) {
      await this.storage.delete(key).catch(() => undefined);
      throw error;
    }
  }

  async findAll(
    familyGroupId: string,
    investmentId: string,
    actor: LedgerActor,
  ): Promise<InvestmentDocumentDto[]> {
    await this.assertInvestment(familyGroupId, investmentId, actor);
    const rows = await this.prisma.investmentAttachment.findMany({
      where: { investmentId, familyGroupId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toDto(r));
  }

  async stream(
    familyGroupId: string,
    investmentId: string,
    attachmentId: string,
    actor: LedgerActor,
  ) {
    await this.assertInvestment(familyGroupId, investmentId, actor);
    const row = await this.prisma.investmentAttachment.findFirst({
      where: { id: attachmentId, investmentId, familyGroupId },
    });
    if (!row) throw new NotFoundException("Attachment not found");
    const stream = await this.storage.download(row.path);
    return { stream, mimeType: row.mimeType, size: row.size };
  }

  async remove(
    familyGroupId: string,
    investmentId: string,
    attachmentId: string,
    actor: LedgerActor,
  ): Promise<void> {
    await this.assertInvestment(familyGroupId, investmentId, actor, true);
    const row = await this.prisma.investmentAttachment.findFirst({
      where: { id: attachmentId, investmentId, familyGroupId },
    });
    if (!row) throw new NotFoundException("Attachment not found");
    await this.prisma.investmentAttachment.delete({ where: { id: row.id } });
    await this.storage.delete(row.path);
  }

  private toDto(r: {
    id: string;
    investmentId: string;
    mimeType: string;
    size: number;
    createdAt: Date;
  }): InvestmentDocumentDto {
    return {
      id: r.id,
      investmentId: r.investmentId,
      mimeType: r.mimeType,
      size: r.size,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
