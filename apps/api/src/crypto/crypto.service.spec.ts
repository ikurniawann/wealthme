import { CryptoService } from "./crypto.service";

import type { Env } from "../config/env";
import type { ConfigService } from "@nestjs/config";

const VALID_KEY_HEX = "a".repeat(64); // 32 bytes

function makeConfig(encryptionKey?: string): ConfigService<Env, true> {
  return {
    get: jest.fn(() => encryptionKey),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("CryptoService", () => {
  describe("constructor", () => {
    it("constructs with no key configured (encryption unavailable)", () => {
      const service = new CryptoService(makeConfig(undefined));
      expect(service.isEncryptionAvailable()).toBe(false);
    });

    it("constructs with a valid 32-byte key (encryption available)", () => {
      const service = new CryptoService(makeConfig(VALID_KEY_HEX));
      expect(service.isEncryptionAvailable()).toBe(true);
    });

    it("throws when the configured key is not exactly 32 bytes", () => {
      expect(() => new CryptoService(makeConfig("ab".repeat(10)))).toThrow(
        /32 bytes/,
      );
    });
  });

  describe("encrypt/decrypt round trip — key configured", () => {
    const service = new CryptoService(makeConfig(VALID_KEY_HEX));

    it("encrypts to a non-plaintext iv:tag:data triplet and decrypts back to the original", () => {
      const plaintext = "sk-ant-real-secret-key";
      const encrypted = service.encrypt(plaintext);

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.split(":")).toHaveLength(3);
      expect(service.decrypt(encrypted)).toBe(plaintext);
    });

    it("decrypt returns the ciphertext unchanged (with a warning, not a throw) for a malformed stored value", () => {
      expect(service.decrypt("not-a-real-ciphertext")).toBe(
        "not-a-real-ciphertext",
      );
    });

    it("decrypt returns the ciphertext unchanged for a tampered auth tag", () => {
      const encrypted = service.encrypt("sk-ant-real-secret-key");
      const [iv, tag, data] = encrypted.split(":") as [string, string, string];
      const tamperedTag = tag.replace(/.$/, tag.endsWith("0") ? "1" : "0");
      const tampered = `${iv}:${tamperedTag}:${data}`;

      expect(service.decrypt(tampered)).toBe(tampered);
    });
  });

  describe("encrypt/decrypt — no key configured (passthrough)", () => {
    const service = new CryptoService(makeConfig(undefined));

    it("encrypt returns the plaintext unchanged", () => {
      expect(service.encrypt("sk-ant-real-secret-key")).toBe(
        "sk-ant-real-secret-key",
      );
    });

    it("decrypt returns its input unchanged", () => {
      expect(service.decrypt("sk-ant-real-secret-key")).toBe(
        "sk-ant-real-secret-key",
      );
    });
  });

  // EPIC-023 Task G retry (HIGH five-reviewer finding) — `tryDecrypt`
  // distinguishes a genuinely corrupt/undecryptable stored value from a
  // successful decryption, so a caller (AiKeyService) can surface a
  // specific "re-enter your key" error instead of silently handing
  // ciphertext to a provider as if it were a real secret.
  describe("tryDecrypt", () => {
    const service = new CryptoService(makeConfig(VALID_KEY_HEX));

    it("returns { ok: true, value } for a genuine round trip", () => {
      const encrypted = service.encrypt("sk-ant-real-secret-key");
      expect(service.tryDecrypt(encrypted)).toEqual({
        ok: true,
        value: "sk-ant-real-secret-key",
      });
    });

    it("returns { ok: false } for a malformed stored value", () => {
      expect(service.tryDecrypt("not-a-real-ciphertext")).toEqual({
        ok: false,
      });
    });

    it("returns { ok: false } when GCM authentication fails (tampered data)", () => {
      const encrypted = service.encrypt("sk-ant-real-secret-key");
      const [iv, tag, data] = encrypted.split(":") as [string, string, string];
      const tamperedData = data.replace(/.$/, data.endsWith("0") ? "1" : "0");

      expect(service.tryDecrypt(`${iv}:${tag}:${tamperedData}`)).toEqual({
        ok: false,
      });
    });

    it("returns { ok: true } passthrough when no key is configured", () => {
      const noKeyService = new CryptoService(makeConfig(undefined));
      expect(noKeyService.tryDecrypt("anything")).toEqual({
        ok: true,
        value: "anything",
      });
    });
  });

  describe("isEncryptionAvailable", () => {
    it("is false with no ENCRYPTION_KEY configured", () => {
      expect(
        new CryptoService(makeConfig(undefined)).isEncryptionAvailable(),
      ).toBe(false);
    });

    it("is true with a valid ENCRYPTION_KEY configured", () => {
      expect(
        new CryptoService(makeConfig(VALID_KEY_HEX)).isEncryptionAvailable(),
      ).toBe(true);
    });
  });
});
