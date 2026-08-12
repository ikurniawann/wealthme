import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Role } from "@prisma/client";

import { AttachmentsService } from "./attachments.service";

const FAMILY_A = "family-a-uuid";
const FAMILY_B = "family-b-uuid";
const TX_ID = "tx-uuid";

// Minimal valid magic-byte buffers for the four allowed types.
const JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const TEXT_BUFFER = Buffer.from("just some plain text, not an image");

function makePrisma() {
  return {
    transaction: { findFirst: jest.fn() },
    transactionAttachment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function makeStorage() {
  return {
    upload: jest.fn().mockResolvedValue("some-key"),
    getSignedUrl: jest.fn(),
    download: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function makeService() {
  const prisma = makePrisma();
  const storage = makeStorage();
  const service = new AttachmentsService(prisma as never, storage as never);
  return { service, prisma, storage };
}

const OWNER_MEMBER = { userId: "owner-user", role: Role.owner };

describe("AttachmentsService", () => {
  describe("create — MIME/size validation", () => {
    it("REJECTS a file whose content does not match an allowed signature, even with a spoofed size", async () => {
      const { service, prisma } = makeService();
      prisma.transaction.findFirst.mockResolvedValue({ id: TX_ID });

      await expect(
        service.create(
          FAMILY_A,
          TX_ID,
          { buffer: TEXT_BUFFER, size: TEXT_BUFFER.length },
          OWNER_MEMBER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("REJECTS a file over 5MB even when its content is a valid signature", async () => {
      const { service, prisma } = makeService();
      prisma.transaction.findFirst.mockResolvedValue({ id: TX_ID });

      await expect(
        service.create(
          FAMILY_A,
          TX_ID,
          { buffer: JPEG_BUFFER, size: 5 * 1024 * 1024 + 1 },
          OWNER_MEMBER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("ACCEPTS a real JPEG under the size limit and stores a server-generated key, never the client filename", async () => {
      const { service, prisma, storage } = makeService();
      prisma.transaction.findFirst.mockResolvedValue({ id: TX_ID });
      prisma.transactionAttachment.create.mockResolvedValue({
        id: "att-1",
        transactionId: TX_ID,
        mimeType: "image/jpeg",
        size: JPEG_BUFFER.length,
        createdAt: new Date("2026-08-01T00:00:00Z"),
      });

      await service.create(
        FAMILY_A,
        TX_ID,
        { buffer: JPEG_BUFFER, size: JPEG_BUFFER.length },
        OWNER_MEMBER,
      );

      const [key] = storage.upload.mock.calls[0] as [string, Buffer, string];
      // Server-generated: familyGroupId/txId/<uuid>.jpg — no arbitrary
      // client-controlled filename segment, no ".." traversal token.
      expect(key).toMatch(/^family-a-uuid\/tx-uuid\/[0-9a-f-]{36}\.jpg$/);
      expect(key).not.toContain("..");
    });
  });

  describe("cross-tenant access", () => {
    it("REFUSES to attach a file to a transaction outside the caller's family group", async () => {
      const { service, prisma } = makeService();
      // The transaction belongs to family B; caller's tenant-scoped query
      // (familyGroupId: FAMILY_A) matches nothing.
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          FAMILY_A,
          TX_ID,
          { buffer: JPEG_BUFFER, size: JPEG_BUFFER.length },
          OWNER_MEMBER,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: TX_ID,
            familyGroupId: FAMILY_A,
          }),
        }),
      );
    });

    it("REFUSES to download an attachment whose id belongs to a different family's transaction", async () => {
      const { service, prisma } = makeService();
      // Transaction lookup succeeds (caller IS a member of family A and the
      // txId happens to exist there)...
      prisma.transaction.findFirst.mockResolvedValue({ id: TX_ID });
      // ...but the attachment row itself was created under family B — the
      // tenant-scoped findFirst (id + transactionId + familyGroupId) must
      // find nothing.
      prisma.transactionAttachment.findFirst.mockResolvedValue(null);

      await expect(
        service.getForDownload(
          FAMILY_A,
          TX_ID,
          "att-owned-by-family-b",
          OWNER_MEMBER,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.transactionAttachment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "att-owned-by-family-b",
            transactionId: TX_ID,
            familyGroupId: FAMILY_A,
          },
        }),
      );
    });

    it("REFUSES to delete an attachment outside the caller's family group", async () => {
      const { service, prisma, storage } = makeService();
      prisma.transaction.findFirst.mockResolvedValue({ id: TX_ID });
      prisma.transactionAttachment.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(FAMILY_B, TX_ID, "att-1", OWNER_MEMBER),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.transactionAttachment.delete).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });

  describe("row-scoped roles", () => {
    it("REFUSES a dependant/operational viewer access to a transaction they neither own nor recorded (existence must not leak)", async () => {
      const { service, prisma } = makeService();
      // restrictedTransactionWhere folds into the same findFirst query —
      // simulate the DB correctly returning nothing for an out-of-scope row.
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(
        service.findAllForTransaction(FAMILY_A, TX_ID, {
          userId: "some-dependant",
          role: Role.dependant,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
