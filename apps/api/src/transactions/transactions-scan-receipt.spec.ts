import { Test, type TestingModule } from "@nestjs/testing";

import { AiKeyCorruptedError } from "../ai-advisor/ai-key-corrupted.error";
import { AiKeyService } from "../ai-advisor/ai-key.service";
import { CATEGORIZATION_PORT } from "../categorization/categorization.port";
import { NOTIFICATION_SENDER_PORT } from "../notifications/notification-sender.port";
import { PrismaService } from "../prisma/prisma.service";

import { OcrNotConfiguredError } from "./ocr/ocr-not-configured.error";
import { OcrFactory } from "./ocr/ocr.factory";
import { TransactionsService } from "./transactions.service";

const FAMILY_GROUP_ID = "fg-scan-uuid";
const IMAGE = "aGVsbG8=";

const OCR_RESULT = {
  amount: 45_000,
  description: "Indomaret",
  occurredAt: "2026-02-01T10:00:00.000Z",
  categoryHint: "Makanan & Minuman",
};

describe("TransactionsService.scanReceipt (EPIC-027 B5/B7)", () => {
  let service: TransactionsService;
  let prisma: { category: { findMany: jest.Mock } };
  let aiKeyService: { resolveDecryptedKey: jest.Mock };
  let ocrFactory: { create: jest.Mock };
  let extractTransaction: jest.Mock;

  beforeEach(async () => {
    prisma = { category: { findMany: jest.fn().mockResolvedValue([]) } };
    aiKeyService = { resolveDecryptedKey: jest.fn() };
    extractTransaction = jest.fn().mockResolvedValue(OCR_RESULT);
    ocrFactory = { create: jest.fn().mockReturnValue({ extractTransaction }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiKeyService, useValue: aiKeyService },
        { provide: OcrFactory, useValue: ocrFactory },
        { provide: CATEGORIZATION_PORT, useValue: { suggest: jest.fn() } },
        {
          provide: NOTIFICATION_SENDER_PORT,
          useValue: { send: jest.fn(), sendEmail: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(TransactionsService);
  });

  it("throws OcrNotConfiguredError when the family has no AI key — never a mock result", async () => {
    aiKeyService.resolveDecryptedKey.mockResolvedValue(null);

    await expect(service.scanReceipt(FAMILY_GROUP_ID, IMAGE)).rejects.toThrow(
      OcrNotConfiguredError,
    );
    expect(ocrFactory.create).not.toHaveBeenCalled();
  });

  it("propagates AiKeyCorruptedError from key resolution", async () => {
    aiKeyService.resolveDecryptedKey.mockRejectedValue(
      new AiKeyCorruptedError(),
    );

    await expect(service.scanReceipt(FAMILY_GROUP_ID, IMAGE)).rejects.toThrow(
      AiKeyCorruptedError,
    );
  });

  it("builds the adapter from the family's own provider + key and returns the mapped result", async () => {
    aiKeyService.resolveDecryptedKey.mockResolvedValue({
      provider: "openai",
      apiKey: "sk-family",
    });
    prisma.category.findMany.mockResolvedValue([
      { id: "cat-food", name: "Makanan & Minuman" },
    ]);

    const result = await service.scanReceipt(FAMILY_GROUP_ID, IMAGE);

    expect(aiKeyService.resolveDecryptedKey).toHaveBeenCalledWith(
      FAMILY_GROUP_ID,
    );
    expect(ocrFactory.create).toHaveBeenCalledWith("openai", "sk-family");
    expect(extractTransaction).toHaveBeenCalledWith(IMAGE);
    expect(result).toEqual({ ...OCR_RESULT, categoryId: "cat-food" });
  });

  it("scopes the category lookup to the caller's family group and expense kind", async () => {
    aiKeyService.resolveDecryptedKey.mockResolvedValue({
      provider: "claude",
      apiKey: "sk-family",
    });

    await service.scanReceipt(FAMILY_GROUP_ID, IMAGE);

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { familyGroupId: FAMILY_GROUP_ID, kind: "expense" },
      select: { id: true, name: true },
    });
  });

  it("returns a null categoryId when no family category matches the hint", async () => {
    aiKeyService.resolveDecryptedKey.mockResolvedValue({
      provider: "gemini",
      apiKey: "sk-family",
    });
    prisma.category.findMany.mockResolvedValue([
      { id: "cat-transport", name: "Transportasi" },
    ]);

    const result = await service.scanReceipt(FAMILY_GROUP_ID, IMAGE);

    expect(result.categoryId).toBeNull();
    expect(result.categoryHint).toBe("Makanan & Minuman");
  });

  it("does not query categories at all when the model returned a blank hint", async () => {
    aiKeyService.resolveDecryptedKey.mockResolvedValue({
      provider: "claude",
      apiKey: "sk-family",
    });
    extractTransaction.mockResolvedValue({ ...OCR_RESULT, categoryHint: "  " });

    const result = await service.scanReceipt(FAMILY_GROUP_ID, IMAGE);

    expect(result.categoryId).toBeNull();
    expect(prisma.category.findMany).not.toHaveBeenCalled();
  });
});
