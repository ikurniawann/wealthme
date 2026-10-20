import { Module } from "@nestjs/common";

import { InvestmentValuationModule } from "../investments/valuation/investment-valuation.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../storage/storage.module";

import { AssetAttachmentsService } from "./asset-attachments.service";
import { AssetLedgerController } from "./asset-ledger.controller";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";
import { AssetTransactionsService } from "./ledger/asset-transactions.service";
import { AssetValuationsService } from "./ledger/asset-valuations.service";
import { AssetsOverviewService } from "./overview/assets-overview.service";

@Module({
  imports: [PrismaModule, StorageModule, InvestmentValuationModule],
  controllers: [AssetsController, AssetLedgerController],
  providers: [
    AssetsService,
    AssetAttachmentsService,
    AssetsOverviewService,
    AssetTransactionsService,
    AssetValuationsService,
  ],
  exports: [AssetsService],
})
export class AssetsModule {}
