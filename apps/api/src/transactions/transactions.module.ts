import { Module } from "@nestjs/common";

import { MockOcrService } from "./ocr/mock-ocr.service";
import { OCR_PORT } from "./ocr/ocr.port";
import { TransactionsController } from "./transactions.controller";
import { TransactionsService } from "./transactions.service";

@Module({
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    { provide: OCR_PORT, useClass: MockOcrService },
  ],
})
export class TransactionsModule {}
