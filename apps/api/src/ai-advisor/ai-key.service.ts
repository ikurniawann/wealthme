import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { type AiProvider } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CryptoService } from "../crypto/crypto.service";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";
import { supportsVisionOcr } from "../transactions/ocr/ocr-provider-support";

import { AiKeyCorruptedError } from "./ai-key-corrupted.error";
import {
  PROVIDER_DEFAULT_MODEL,
  listProviderModels,
  type ProviderModel,
} from "./provider-models.util";

import type { SetAiKeyDto } from "./dto/set-ai-key.dto";

const KEY_HINT_LENGTH = 4;

export type AiKeyStatusDto = {
  configured: boolean;
  provider: AiProvider | null;
  keyHint: string | null;
  /** The family's chosen model; null means the default below is in use. */
  model?: string | null;
  /** What runs when nothing is chosen, so the UI never implies "no model". */
  defaultModel?: string | null;
  /**
   * EPIC-027 B5 (D11) — whether receipt scanning can actually work: a key
   * is configured AND its provider has a vision adapter. Receipt OCR runs
   * on this same family key, so the client must be able to ask BEFORE it
   * offers a camera button, instead of showing one that always fails.
   */
  scanAvailable: boolean;
};

export type ResolvedAiKey = {
  provider: AiProvider;
  apiKey: string;
  /** The family's chosen model, or null to use the code's default. */
  model: string | null;
};

function maskHint(apiKey: string): string {
  return apiKey.length <= KEY_HINT_LENGTH
    ? "••••"
    : `••••${apiKey.slice(-KEY_HINT_LENGTH)}`;
}

/**
 * EPIC-023 G3 (D16) — bring-your-own AI provider key, AES-256-GCM encrypted
 * at rest via the existing CryptoService (same pattern as
 * Account.maskedNumber). Contract with every caller: `apiKey` NEVER leaves
 * this service decrypted except via `resolveDecryptedKey`, which
 * `AiAdvisorService` calls internally to build a per-request advisor
 * instance — it is never returned to an HTTP response, never logged, and
 * never included in an error message (see AiAdvisorService/controller).
 */
@Injectable()
export class AiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async getStatus(familyGroupId: string): Promise<AiKeyStatusDto> {
    const row = await this.prisma.familyAiKey.findUnique({
      where: { familyGroupId },
      select: { provider: true, keyHint: true, model: true },
    });
    if (!row) {
      return {
        configured: false,
        provider: null,
        keyHint: null,
        scanAvailable: false,
        model: null,
        defaultModel: null,
      };
    }
    return {
      configured: true,
      provider: row.provider,
      keyHint: row.keyHint,
      scanAvailable: supportsVisionOcr(row.provider),
      model: row.model,
      // Sent alongside so the UI can say WHICH model is in use when the family
      // has chosen nothing, instead of showing an empty select that implies
      // no model at all.
      defaultModel: PROVIDER_DEFAULT_MODEL[row.provider],
    };
  }

  async setKey(
    familyGroupId: string,
    dto: SetAiKeyDto,
  ): Promise<AiKeyStatusDto> {
    // EPIC-023 Task G retry (HIGH five-reviewer finding) — refuse to store a
    // live, billable provider key AT ALL when server-side encryption isn't
    // configured, rather than silently persisting it in cleartext. Narrower
    // and safer than tightening the global ENCRYPTION_KEY env guard (which
    // other, non-secret callers of CryptoService also depend on).
    if (!this.crypto.isEncryptionAvailable()) {
      throw new InternalServerErrorException(
        "Tidak bisa menyimpan API key: enkripsi sisi server belum dikonfigurasi (ENCRYPTION_KEY belum diset). Hubungi administrator sebelum menambahkan key.",
      );
    }

    const encryptedKey = this.crypto.encrypt(dto.apiKey);
    const keyHint = maskHint(dto.apiKey);

    const row = await this.prisma.familyAiKey.upsert({
      where: { familyGroupId },
      create: { familyGroupId, provider: dto.provider, encryptedKey, keyHint },
      // The model is CLEARED on every key write. A model id belongs to one
      // provider — carrying `gpt-4o-mini` onto a Gemini key would 404 every
      // call — and even within a provider a new key may not be entitled to
      // the old choice. Falling back to the default is recoverable; a stale
      // id silently breaking every AI feature is not.
      update: {
        provider: dto.provider,
        encryptedKey,
        keyHint,
        model: null,
      },
      select: { provider: true, keyHint: true, model: true },
    });

    return {
      configured: true,
      provider: row.provider,
      keyHint: row.keyHint,
      scanAvailable: supportsVisionOcr(row.provider),
      model: row.model,
      defaultModel: PROVIDER_DEFAULT_MODEL[row.provider],
    };
  }

  /**
   * What this family's key can currently use.
   *
   * Asked of the provider rather than hardcoded — a baked-in list is wrong
   * the moment a model ships or is retired, which this project has already
   * been bitten by. Requires a stored key, and uses it only to make the
   * catalogue call: the key is never returned to the response.
   */
  async listModels(familyGroupId: string): Promise<ProviderModel[]> {
    const resolved = await this.resolveDecryptedKey(familyGroupId);
    if (!resolved) {
      throw new NotFoundException("No AI provider key configured");
    }
    return listProviderModels(resolved.provider, resolved.apiKey);
  }

  /**
   * Records the family's choice.
   *
   * `null` is a first-class value meaning "use the default" — that is how a
   * family undoes a choice without deleting their key. The id is NOT checked
   * against the catalogue here: providers add models constantly, and a
   * refusal based on a list this server happens to know would block a model
   * the key can genuinely use. A wrong id surfaces as the provider's own
   * error on the next call, which names the model.
   */
  async setModel(
    familyGroupId: string,
    model: string | null,
  ): Promise<AiKeyStatusDto> {
    const row = await this.prisma.familyAiKey.findUnique({
      where: { familyGroupId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException("No AI provider key configured");
    }
    const updated = await this.prisma.familyAiKey.update({
      where: { id: row.id },
      data: { model: model?.trim() ? model.trim() : null },
      select: { provider: true, keyHint: true, model: true },
    });
    return {
      configured: true,
      provider: updated.provider,
      keyHint: updated.keyHint,
      scanAvailable: supportsVisionOcr(updated.provider),
      model: updated.model,
      defaultModel: PROVIDER_DEFAULT_MODEL[updated.provider],
    };
  }

  async deleteKey(familyGroupId: string): Promise<void> {
    const row = await this.prisma.familyAiKey.findUnique({
      where: { familyGroupId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException("No AI provider key configured");
    }
    await this.prisma.familyAiKey.delete({ where: { id: row.id } });
  }

  /**
   * Internal-only — returns the DECRYPTED key. Never call this from a
   * controller; it exists solely so a SERVICE can build a per-request
   * provider adapter — today `AiAdvisorService.streamChat` (advisor chat)
   * and `TransactionsService.scanReceipt` (EPIC-027 D11, receipt OCR on the
   * same family key). Both follow the same rule (D16): resolved per family,
   * per request — never a process-wide DI binding, and never a fallback to a
   * shared server key. The decrypted key is never returned to an HTTP
   * response, never logged, and never included in an error message.
   */
  async resolveDecryptedKey(
    familyGroupId: string,
  ): Promise<ResolvedAiKey | null> {
    const row = await this.prisma.familyAiKey.findUnique({
      where: { familyGroupId },
      select: { provider: true, encryptedKey: true, model: true },
    });
    if (!row) return null;

    // EPIC-023 Task G retry (HIGH five-reviewer finding) — an undecryptable
    // stored key (corrupted row, or ENCRYPTION_KEY rotated since it was
    // saved) must surface its OWN distinct, actionable error — not silently
    // resolve to mangled ciphertext that the provider then rejects as a
    // generic auth failure.
    const decrypted = this.crypto.tryDecrypt(row.encryptedKey);
    if (!decrypted.ok) {
      throw new AiKeyCorruptedError();
    }
    return {
      provider: row.provider,
      apiKey: decrypted.value,
      model: row.model,
    };
  }
}
