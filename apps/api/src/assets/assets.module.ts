import { Module } from "@nestjs/common";

import { InvestmentValuationModule } from "../investments/valuation/investment-valuation.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../storage/storage.module";

import { AssetAttachmentsService } from "./asset-attachments.service";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";
import { AssetsOverviewService } from "./overview/assets-overview.service";

@Module({
  imports: [PrismaModule, StorageModule, InvestmentValuationModule],
  controllers: [AssetsController],
  providers: [AssetsService, AssetAttachmentsService, AssetsOverviewService],
  exports: [AssetsService],
})
export class AssetsModule {}
