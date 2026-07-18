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
    if (!this.key || !ciphertext) return ciphertext;
    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
      this.logger.warn(
        `decrypt: unexpected format for stored value, returning as-is`,
      );
      return ciphertext;
    }
    const [ivHex, authTagHex, dataHex] = parts as [string, string, string];
    try {
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const data = Buffer.from(dataHex, "hex");
      const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString(
        "utf8",
      );
    } catch {
      this.logger.warn(
        `decrypt: GCM authentication failed, ciphertext may be tampered`,
      );
      return ciphertext;
    }
  }
}
