/**
 * EPIC-023 G3 (D16) — thrown by AiAdvisorService when a family has no AI
 * provider key configured. The controller maps this to a distinguishable
 * SSE payload (`code: "AI_NOT_CONFIGURED"`) so the web app renders a
 * disabled-advisor panel with setup instructions — never a mock answer
 * presented as advice.
 */
export class AiAdvisorNotConfiguredError extends Error {
  constructor() {
    super(
      "AI advisor belum dikonfigurasi untuk keluarga ini — tambahkan API key penyedia AI di Pengaturan.",
    );
    this.name = "AiAdvisorNotConfiguredError";
  }
}
