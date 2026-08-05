import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from "@nestjs/config";

import type { Env } from "../config/env";

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly key: Buffer | null;

  constructor(config: ConfigService<Env, true>) {
    const keyHex = config.get("ENCRYPTION_KEY", { infer: true });
    this.key = keyHex ? Buffer.from(keyHex, "hex") : null;
    if (this.key && this.key.length !== 32) {
      throw new Error(
        `ENCRYPTION_KEY must be 32 bytes (64 hex chars); got ${this.key.length} bytes`,
      );
    }
  }

  encrypt(plaintext: string): string {
    if (!this.key || !plaintext) return plaintext;
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
  }

  decrypt(ciphertext: string): string {
    const result = this.tryDecrypt(ciphertext);
    if (result.ok) return result.value;
    this.logger.warn(
      `decrypt: unable to decrypt stored value (unexpected format or GCM auth failure), returning as-is`,
    );
    return ciphertext;
  }

  /**
   * EPIC-023 Task G retry (HIGH five-reviewer finding) — same AES-256-GCM
   * decryption as `decrypt`, but DISTINGUISHES failure from success instead
   * of silently falling back to the ciphertext. `decrypt` keeps its
   * existing passthrough behaviour for its other callers (unchanged); this
   * is for a caller (AiKeyService) that must surface "this stored value is
   * corrupt/undecryptable" as its own actionable error rather than handing
   * mangled ciphertext to a downstream provider API as if it were a real
   * secret.
   */
  tryDecrypt(ciphertext: string): { ok: true; value: string } | { ok: false } {
    if (!this.key || !ciphertext) return { ok: true, value: ciphertext };
    const parts = ciphertext.split(":");
    if (parts.length !== 3) return { ok: false };
    const [ivHex, authTagHex, dataHex] = parts as [string, string, string];
    try {
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const data = Buffer.from(dataHex, "hex");
      const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
      decipher.setAuthTag(authTag);
      const value = Buffer.concat([
        decipher.update(data),
        decipher.final(),
      ]).toString("utf8");
      return { ok: true, value };
    } catch {
      return { ok: false };
    }
  }

  /**
   * EPIC-023 Task G retry (HIGH five-reviewer finding) — lets a caller
   * refuse to persist a secret at all when `ENCRYPTION_KEY` is unset,
   * rather than silently storing it in cleartext (see `AiKeyService.setKey`).
   */
  isEncryptionAvailable(): boolean {
    return this.key !== null;
  }
}
