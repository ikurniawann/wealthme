import {
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";

import { AiKeyCorruptedError } from "./ai-key-corrupted.error";
import { AiKeyService } from "./ai-key.service";

const FAMILY_GROUP_ID = "fg-1";

function makePrisma() {
  return {
    familyAiKey: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function makeCrypto() {
  return {
    encrypt: jest.fn((v: string) => `enc:${v}`),
    decrypt: jest.fn((v: string) => v.replace(/^enc:/, "")),
    tryDecrypt: jest.fn((v: string) =>
      v.startsWith("enc:")
        ? { ok: true, value: v.replace(/^enc:/, "") }
        : { ok: false },
    ),
    isEncryptionAvailable: jest.fn(() => true),
  };
}

describe("AiKeyService", () => {
  let service: AiKeyService;
  let prisma: ReturnType<typeof makePrisma>;
  let crypto: ReturnType<typeof makeCrypto>;

  beforeEach(() => {
    prisma = makePrisma();
    crypto = makeCrypto();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new AiKeyService(prisma as any, crypto as any);
  });

  describe("getStatus", () => {
    it("reports not configured when no row exists", async () => {
      prisma.familyAiKey.findUnique.mockResolvedValue(null);

      const status = await service.getStatus(FAMILY_GROUP_ID);

      expect(status).toEqual({
        configured: false,
        provider: null,
        keyHint: null,
        // EPIC-027 B5 (D11) — receipt OCR runs on this same family key, so
        // "no key" also means "no scanning".
        scanAvailable: false,
      });
    });

    it("reports configured with provider + hint, never the raw/encrypted key", async () => {
      prisma.familyAiKey.findUnique.mockResolvedValue({
        provider: "claude",
        keyHint: "••••ab12",
      });

      const status = await service.getStatus(FAMILY_GROUP_ID);

      expect(status).toEqual({
        configured: true,
        provider: "claude",
        keyHint: "••••ab12",
        scanAvailable: true,
      });
      // The select projection must never request encryptedKey for a status
      // read — this call shape is the actual guarantee, not just the
      // returned object shape.
      expect(prisma.familyAiKey.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { provider: true, keyHint: true },
        }),
      );
    });
  });

  describe("setKey", () => {
    it("encrypts the raw key before storing it and returns only a masked hint", async () => {
      prisma.familyAiKey.upsert.mockResolvedValue({
        provider: "openai",
        keyHint: "••••wxyz",
      });

      const result = await service.setKey(FAMILY_GROUP_ID, {
        provider: "openai",
        apiKey: "sk-abcdwxyz",
      });

      expect(crypto.encrypt).toHaveBeenCalledWith("sk-abcdwxyz");
      expect(result).toEqual({
        configured: true,
        provider: "openai",
        keyHint: "••••wxyz",
        scanAvailable: true,
      });

      const upsertArg = prisma.familyAiKey.upsert.mock.calls[0]?.[0];
      expect(upsertArg.create.encryptedKey).toBe("enc:sk-abcdwxyz");
      // The raw key must only ever appear wrapped by crypto.encrypt()'s
      // output — never as a bare create/update field value of its own.
      expect(upsertArg.create.encryptedKey).not.toBe("sk-abcdwxyz");
      expect(upsertArg.update.encryptedKey).not.toBe("sk-abcdwxyz");
    });

    it("upserts keyed by familyGroupId — switching provider overwrites, not accumulates", async () => {
      prisma.familyAiKey.upsert.mockResolvedValue({
        provider: "gemini",
        keyHint: "••••1234",
      });

      await service.setKey(FAMILY_GROUP_ID, {
        provider: "gemini",
        apiKey: "AIzaSy1234",
      });

      expect(prisma.familyAiKey.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { familyGroupId: FAMILY_GROUP_ID } }),
      );
    });

    // EPIC-023 Task G retry (HIGH five-reviewer finding) — any environment
    // where ENCRYPTION_KEY is unset (staging/uat/unset/a typo — not just
    // "not production") must refuse to store a live provider key rather
    // than silently persisting it in cleartext.
    it("refuses to store the key at all when server-side encryption is unavailable", async () => {
      crypto.isEncryptionAvailable.mockReturnValue(false);

      await expect(
        service.setKey(FAMILY_GROUP_ID, {
          provider: "openai",
          apiKey: "sk-abcdwxyz",
        }),
      ).rejects.toThrow(InternalServerErrorException);
      expect(crypto.encrypt).not.toHaveBeenCalled();
      expect(prisma.familyAiKey.upsert).not.toHaveBeenCalled();
    });
  });

  describe("deleteKey", () => {
    it("throws NotFoundException when no key is configured", async () => {
      prisma.familyAiKey.findUnique.mockResolvedValue(null);

      await expect(service.deleteKey(FAMILY_GROUP_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.familyAiKey.delete).not.toHaveBeenCalled();
    });

    it("deletes the row when one exists", async () => {
      prisma.familyAiKey.findUnique.mockResolvedValue({ id: "key-1" });

      await service.deleteKey(FAMILY_GROUP_ID);

      expect(prisma.familyAiKey.delete).toHaveBeenCalledWith({
        where: { id: "key-1" },
      });
    });
  });

  describe("resolveDecryptedKey", () => {
    it("returns null when no key is configured", async () => {
      prisma.familyAiKey.findUnique.mockResolvedValue(null);

      await expect(
        service.resolveDecryptedKey(FAMILY_GROUP_ID),
      ).resolves.toBeNull();
    });

    it("decrypts and returns the provider + raw key for internal use only", async () => {
      prisma.familyAiKey.findUnique.mockResolvedValue({
        provider: "claude",
        encryptedKey: "enc:sk-ant-real-key",
      });

      const resolved = await service.resolveDecryptedKey(FAMILY_GROUP_ID);

      expect(resolved).toEqual({
        provider: "claude",
        apiKey: "sk-ant-real-key",
      });
    });

    // EPIC-023 Task G retry (HIGH five-reviewer finding) — a corrupted
    // stored key (or one written before an ENCRYPTION_KEY rotation) must
    // surface its OWN distinct error rather than resolving to mangled
    // ciphertext that the provider then rejects as a generic auth failure.
    it("throws AiKeyCorruptedError when the stored key cannot be decrypted", async () => {
      prisma.familyAiKey.findUnique.mockResolvedValue({
        provider: "claude",
        encryptedKey: "not-real-ciphertext",
      });

      await expect(
        service.resolveDecryptedKey(FAMILY_GROUP_ID),
      ).rejects.toThrow(AiKeyCorruptedError);
    });
  });
});
