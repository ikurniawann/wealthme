/**
 * Hardening batch G2 — tax's "+ Upload" used to only toast "belum
 * tersedia". TaxDocumentsService mirrors AssetAttachmentsService exactly
 * (sniffed mime, ≤5MB cap, tenant-scoped storage key); these tests verify
 * the same guarantees hold here.
 */

import { BadRequestException, NotFoundException } from "@nestjs/common";

import {
  MAX_TAX_DOCUMENT_BYTES,
  TaxDocumentsService,
} from "./tax-documents.service";

const PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

describe("TaxDocumentsService", () => {
  let prisma: {
    taxDocument: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
    };
  };
  let storage: {
    upload: jest.Mock;
    download: jest.Mock;
    delete: jest.Mock;
  };
  let service: TaxDocumentsService;

  beforeEach(() => {
    prisma = {
      taxDocument: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    };
    storage = { upload: jest.fn(), download: jest.fn(), delete: jest.fn() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new TaxDocumentsService(prisma as any, storage as any);
  });

  describe("create", () => {
    it("rejects a file over MAX_TAX_DOCUMENT_BYTES without touching storage", async () => {
      await expect(
        service.create("fg-1", 2026, {
          buffer: PNG_BUFFER,
          size: MAX_TAX_DOCUMENT_BYTES + 1,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it("rejects a file whose sniffed content isn't an allowed mime", async () => {
      const buffer = Buffer.from("not an image or pdf");
      await expect(
        service.create("fg-1", 2026, { buffer, size: buffer.length }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it("uploads under a tenant-scoped key and persists the row", async () => {
      prisma.taxDocument.create.mockResolvedValue({
        id: "doc-1",
        taxYear: 2026,
        mimeType: "image/png",
        size: PNG_BUFFER.length,
        createdAt: new Date("2026-09-29T00:00:00.000Z"),
      });

      const result = await service.create("fg-1", 2026, {
        buffer: PNG_BUFFER,
        size: PNG_BUFFER.length,
      });

      const [key, buffer, mime] = storage.upload.mock.calls[0] as [
        string,
        Buffer,
        string,
      ];
      expect(key).toMatch(/^fg-1\/tax\/2026\/.+\.png$/);
      expect(buffer).toBe(PNG_BUFFER);
      expect(mime).toBe("image/png");
      expect(prisma.taxDocument.create).toHaveBeenCalledWith({
        data: {
          familyGroupId: "fg-1",
          taxYear: 2026,
          path: key,
          mimeType: "image/png",
          size: PNG_BUFFER.length,
        },
      });
      expect(result).toEqual({
        id: "doc-1",
        taxYear: 2026,
        mimeType: "image/png",
        size: PNG_BUFFER.length,
        createdAt: "2026-09-29T00:00:00.000Z",
      });
    });
  });

  describe("findAll", () => {
    it("scopes by both familyGroupId and taxYear", async () => {
      prisma.taxDocument.findMany.mockResolvedValue([]);
      await service.findAll("fg-1", 2026);
      expect(prisma.taxDocument.findMany).toHaveBeenCalledWith({
        where: { familyGroupId: "fg-1", taxYear: 2026 },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("remove", () => {
    it("throws NotFoundException for a document from another family/year", async () => {
      prisma.taxDocument.findFirst.mockResolvedValue(null);
      await expect(
        service.remove("fg-1", 2026, "doc-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it("deletes the row then the storage object", async () => {
      prisma.taxDocument.findFirst.mockResolvedValue({
        id: "doc-1",
        path: "fg-1/tax/2026/doc-1.png",
      });
      await service.remove("fg-1", 2026, "doc-1");
      expect(prisma.taxDocument.delete).toHaveBeenCalledWith({
        where: { id: "doc-1" },
      });
      expect(storage.delete).toHaveBeenCalledWith("fg-1/tax/2026/doc-1.png");
    });
  });
});
