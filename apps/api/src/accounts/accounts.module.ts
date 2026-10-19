import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { TransactionsModule } from "../transactions/transactions.module";

import { AccountReconcileService } from "./account-reconcile.service";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";

@Module({
  // TransactionsModule: "Cocokkan saldo" books its correction as a real
  // transaction through the same service the dialog uses.
  imports: [PrismaModule, TransactionsModule],
  controllers: [AccountsController],
  providers: [AccountsService, AccountReconcileService],
})
export class AccountsModule {}
