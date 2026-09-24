import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { type Role } from "@prisma/client";

import {
  canSeePrivateItems,
  restrictedTransactionWhere,
  transactionPrivacyWhere,
  isRowScopedRole,
} from "../common/utils/privacy.util";
// PrismaService/StoragePort are injected by class reference (NestJS DI
// resolves the provider from the constructor parameter's runtime type via
// reflect-metadata) — these must stay real imports, not `import type`, or
// Nest cannot resolve them at bootstrap (same pattern as the DTO imports in
// reconciliation.controller.ts).
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { StoragePort } from "../storage/storage.port";

import { detectAllowedMime, extensionForMime } from "./file-signature.util";

import type { TransactionAttachmentResponseDto } from "./dto/transaction-attachment-response.dto";

// EPIC-024 Task L2 (US-TXN-9) — jpg/png/webp/pdf only, ≤5MB. Also enforced
// at the multer/FileInterceptor layer (belt + suspenders — see
// attachments.controller.ts's MAX_ATTACHMENT_FILE_BYTES).
const MAX_ATTACHMENT_FILE_BYTES = 5 * 1024 * 1024;

export type ActingMember = {
  userId: string;
  role: Role;
  /** EPIC-030 — effective data scope; defaults to the role rule when absent. */
  rowScoped?: boolean;
  seesSharedAccounts?: boolean;
} | null;

export type AttachmentFileInput = {
  buffer: Buffer;
  size: number;
};

type AttachmentRow = {
  id: string;
  transactionId: string;
  mimeType: string;
  size: number;
  createdAt: Date;
};

function toDto(row: AttachmentRow): TransactionAttachmentResponseDto {
  return {
    id: row.id,
    transactionId: row.transactionId,
    mimeType: row.mimeType,
    size: row.size,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StoragePort,
  ) {}

  /**
   * Confirms `transactionId` exists, belongs to `familyGroupId`, AND is
   * visible to the acting member (privacy + row-scoping) before any
   * attachment read/write proceeds. Returns nothing — callers only need the
   * existence check; throwing NotFoundException (not Forbidden) on failure
   * matches `TransactionsService.findOne`'s "existence must not leak"
   * convention for a privacy/row-scope miss.
   */
  private async assertTransactionVisible(
    familyGroupId: string,
    transactionId: string,
    actingMember: ActingMember,
  ): Promise<void> {
    const canSeePrivate = canSeePrivateItems(actingMember?.role ?? null);
    const tx = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        familyGroupId,
        AND: [
          transactionPrivacyWhere(canSeePrivate),
          restrictedTransactionWhere(
            actingMember
              ? {
                  role: actingMember.role,
                  rowScoped:
                    actingMember.rowScoped ??
                    isRowScopedRole(actingMember.role),
                  seesSharedAccounts: actingMember.seesSharedAccounts,
                }
              : null,
            actingMember?.userId,
          ),
        ],
      },
      select: { id: true },
    });
    if (!tx) throw new NotFoundException("Transaction not found");
  }

  async create(
    familyGroupId: string,
    transactionId: string,
    file: AttachmentFileInput,
    actingMember: ActingMember,
  ): Promise<TransactionAttachmentResponseDto> {
    await this.assertTransactionVisible(
      familyGroupId,
      transactionId,
      actingMember,
    );

    if (file.size > MAX_ATTACHMENT_FILE_BYTES) {
      throw new BadRequestException("File exceeds 5MB");
    }

    // MIME spoofing defense (US-TXN-9 / security constraint) — the client's
    // Content-Type/filename is never trusted; only the sniffed content
    // signature decides the stored mimeType and extension.
    const detectedMime = detectAllowedMime(file.buffer);
    if (!detectedMime) {
      throw new BadRequestException(
        "Unsupported file type — only JPG, PNG, WEBP, or PDF are allowed",
      );
    }

    // Path-traversal defense (security constraint) — the storage KEY is a
    // server-generated UUID, never derived from the client's filename.
    const key = `${familyGroupId}/${transactionId}/${randomUUID()}.${extensionForMime(detectedMime)}`;
    await this.storage.upload(key, file.buffer, detectedMime);

    const created = await this.prisma.transactionAttachment.create({
      data: {
        transactionId,
        familyGroupId,
        path: key,
        mimeType: detectedMime,
        size: file.size,
      },
      select: {
        id: true,
        transactionId: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    });
    return toDto(created);
  }

  async findAllForTransaction(
    familyGroupId: string,
    transactionId: string,
    actingMember: ActingMember,
  ): Promise<TransactionAttachmentResponseDto[]> {
    await this.assertTransactionVisible(
      familyGroupId,
      transactionId,
      actingMember,
    );
    const rows = await this.prisma.transactionAttachment.findMany({
      where: { transactionId, familyGroupId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        transactionId: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    });
    return rows.map(toDto);
  }

  /**
   * Returns the attachment's storage key + mime type for streaming, after
   * confirming BOTH the transaction is visible to the caller AND the
   * attachment row itself matches `transactionId` + `familyGroupId` in the
   * same query — a cross-tenant `attachmentId` guess (a member of family A
   * probing a real id that belongs to family B) matches nothing and 404s,
   * exactly like a made-up id would.
   */
  async getForDownload(
    familyGroupId: string,
    transactionId: string,
    attachmentId: string,
    actingMember: ActingMember,
  ): Promise<{ key: string; mimeType: string; size: number }> {
    await this.assertTransactionVisible(
      familyGroupId,
      transactionId,
      actingMember,
    );
    const attachment = await this.prisma.transactionAttachment.findFirst({
      where: { id: attachmentId, transactionId, familyGroupId },
      select: { path: true, mimeType: true, size: true },
    });
    if (!attachment) throw new NotFoundException("Attachment not found");
    return {
      key: attachment.path,
      mimeType: attachment.mimeType,
      size: attachment.size,
    };
  }

  /** Same tenant-scoping as `getForDownload`, plus the actual readable
   * stream from StoragePort — split into two methods only so the
   * key-resolution logic is independently testable without touching disk. */
  async stream(
    familyGroupId: string,
    transactionId: string,
    attachmentId: string,
    actingMember: ActingMember,
  ): Promise<{
    stream: NodeJS.ReadableStream;
    mimeType: string;
    size: number;
  }> {
    const { key, mimeType, size } = await this.getForDownload(
      familyGroupId,
      transactionId,
      attachmentId,
      actingMember,
    );
    const stream = await this.storage.download(key);
    return { stream, mimeType, size };
  }

  async remove(
    familyGroupId: string,
    transactionId: string,
    attachmentId: string,
    actingMember: ActingMember,
  ): Promise<void> {
    await this.assertTransactionVisible(
      familyGroupId,
      transactionId,
      actingMember,
    );
    const attachment = await this.prisma.transactionAttachment.findFirst({
      where: { id: attachmentId, transactionId, familyGroupId },
      select: { id: true, path: true },
    });
    if (!attachment) throw new NotFoundException("Attachment not found");

    await this.prisma.transactionAttachment.delete({
      where: { id: attachment.id },
    });
    // Delete the DB row first: if disk delete fails, an orphaned file on
    // disk is a harmless leak; an orphaned DB row pointing at an already-
    // deleted file would 500 every future download attempt.
    await this.storage.delete(attachment.path);
  }
}
