import { Injectable } from "@nestjs/common";

import { AiAdvisorPort } from "./ai-advisor.port";

import type {
  AdvisorChatResult,
  AdvisorContext,
  AdvisorMessage,
} from "./ai-advisor.port";

/**
 * EPIC-023 G3 (D16) — kept ONLY for tests that need a fast, deterministic
 * `AiAdvisorPort` double. It is NOT wired into `AiAdvisorModule`,
 * `AiAdvisorFactory`, or any DI provider — a family with no key sees the
 * advisor disabled with instructions (AiAdvisorNotConfiguredError), never
 * this mock's canned reply presented as advice. Do not reference this
 * class from production wiring.
 */
@Injectable()
export class MockAdvisorService extends AiAdvisorPort {
  async chat(
    _context: AdvisorContext,
    messages: AdvisorMessage[],
    onToken: (token: string) => void,
  ): Promise<AdvisorChatResult> {
    const last = messages[messages.length - 1]?.content ?? "";
    const reply =
      `(Mock) Halo! Kamu bertanya: "${last.slice(0, 60)}". ` +
      `Berdasarkan data keuanganmu, saya sarankan untuk mengoptimalkan alokasi pengeluaran. ` +
      `Disclaimer: saran ini bersifat informatif, bukan nasihat investasi profesional.`;

    // Simulate streaming
    for (const chunk of reply.match(/.{1,20}/g) ?? []) {
      onToken(chunk);
      await new Promise<void>((r) => setTimeout(r, 10));
    }

    return { truncated: false };
  }
}
