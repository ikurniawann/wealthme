import Anthropic from "@anthropic-ai/sdk";
import { Injectable } from "@nestjs/common";

import { AiAdvisorPort } from "./ai-advisor.port";

import type { AdvisorContext, AdvisorMessage } from "./ai-advisor.port";

const MODEL = "claude-sonnet-4-6" as const;

function buildSystemPrompt(ctx: AdvisorContext): string {
  const toM = (n: bigint) => `Rp ${(Number(n) / 1_000_000).toFixed(2)} jt`;
  const categories = ctx.topCategories
    .map((c) => `  - ${c.name}: ${toM(c.amount)}`)
    .join("\n");
  return `Kamu adalah WealthMe AI Advisor, asisten keuangan personal yang membantu keluarga Indonesia mengelola keuangan.

Data keuangan user (bulan ini):
- Kekayaan bersih: ${toM(ctx.netWorth)}
- Pendapatan bulanan: ${toM(ctx.monthlyIncome)}
- Pengeluaran bulanan: ${toM(ctx.monthlyExpense)}
- Total aset: ${toM(ctx.totalAssets)}
- Total liabilitas: ${toM(ctx.totalLiabilities)}
- Kategori pengeluaran teratas:
${categories || "  (belum ada data)"}

Panduan:
- Jawab dalam bahasa Indonesia yang ramah dan mudah dimengerti.
- Berikan saran konkret berdasarkan data di atas.
- Untuk perhitungan zakat dan PPh 21, selalu arahkan user ke fitur Kalkulator di aplikasi — jangan hitung sendiri di sini.
- Jangan membagikan atau menampilkan informasi yang mungkin bersifat sensitif selain yang ada di konteks ini.
- Jawaban singkat dan padat kecuali diminta detail.
- Disclaimer: "Saran ini bersifat informatif, bukan nasihat investasi profesional."`;
}

@Injectable()
export class ClaudeAdvisorService extends AiAdvisorPort {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    super();
    this.client = new Anthropic({ apiKey });
  }

  async chat(
    context: AdvisorContext,
    messages: AdvisorMessage[],
    onToken: (token: string) => void,
  ): Promise<void> {
    const stream = this.client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(context),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        onToken(event.delta.text);
      }
    }
  }
}
