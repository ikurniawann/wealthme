import { Module } from "@nestjs/common";

import { AccountsModule } from "../accounts/accounts.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TransactionsModule } from "../transactions/transactions.module";

import { PlatformAccountsController } from "./platform-accounts.controller";
import { PlatformAccountsService } from "./platform-accounts.service";
import { PocketTransfersService } from "./pocket-transfers.service";

@Module({
  // AccountsModule: pockets are Accounts created under the same owner rules.
  // TransactionsModule: top-up/withdraw are ordinary transfers.
  // FxModule and CryptoModule are global.
  imports: [PrismaModule, AccountsModule, TransactionsModule],
  controllers: [PlatformAccountsController],
  providers: [PlatformAccountsService, PocketTransfersService],
  exports: [PlatformAccountsService],
})
export class PlatformAccountsModule {}
