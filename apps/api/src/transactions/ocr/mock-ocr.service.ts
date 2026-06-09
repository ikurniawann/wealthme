import { Injectable } from "@nestjs/common";

import type { OcrPort, OcrResult } from "./ocr.port";

const MOCK_MERCHANTS = [
  "Indomaret",
  "Alfamart",
  "Starbucks",
  "KFC",
  "McDonald's",
  "Tokopedia",
  "Shopee",
  "GoPay Top Up",
];

const MOCK_CATEGORIES = [
  "Makanan & Minuman",
  "Belanja",
  "Transportasi",
  "Hiburan",
];

@Injectable()
export class MockOcrService implements OcrPort {
  extractTransaction(_imageBase64: string): Promise<OcrResult> {
    const amount = Math.floor(Math.random() * 500_000) + 10_000;
    const merchant =
      MOCK_MERCHANTS[Math.floor(Math.random() * MOCK_MERCHANTS.length)] ??
      "Merchant";
    const categoryHint =
      MOCK_CATEGORIES[Math.floor(Math.random() * MOCK_CATEGORIES.length)] ??
      "Lainnya";
    const occurredAt = new Date().toISOString();

    return Promise.resolve({
      amount,
      description: merchant,
      occurredAt,
      categoryHint,
    });
  }
}
