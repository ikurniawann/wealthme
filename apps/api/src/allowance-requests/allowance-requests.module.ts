import { Module } from "@nestjs/common";

import { TransactionsModule } from "../transactions/transactions.module";

import { AllowanceRequestsController } from "./allowance-requests.controller";
import { AllowanceRequestsService } from "./allowance-requests.service";

@Module({
  // TransactionsModule exports TransactionsService so approve() can reuse
  // the EPIC-021 Group B transfer primitive instead of duplicating it.
  imports: [TransactionsModule],
  controllers: [AllowanceRequestsController],
  providers: [AllowanceRequestsService],
})
export class AllowanceRequestsModule {}
