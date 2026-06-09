export interface OcrResult {
  amount: number;
  description: string;
  occurredAt: string;
  categoryHint: string;
}

export interface OcrPort {
  extractTransaction(imageBase64: string): Promise<OcrResult>;
}

export const OCR_PORT = "OCR_PORT";
