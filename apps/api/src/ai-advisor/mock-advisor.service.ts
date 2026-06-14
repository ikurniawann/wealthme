import { Injectable } from "@nestjs/common";

import { AiAdvisorPort } from "./ai-advisor.port";

import type { AdvisorContext, AdvisorMessage } from "./ai-advisor.port";

@Injectable()
export class MockAdvisorService extends AiAdvisorPort {
  async chat(
    _context: AdvisorContext,
    messages: AdvisorMessage[],
    onToken: (token: string) => void,
  ): Promise<void> {
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
  }
}
