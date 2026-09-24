import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../storage/storage.module";

import { AssetAttachmentsService } from "./asset-attachments.service";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [AssetsController],
  providers: [AssetsService, AssetAttachmentsService],
  exports: [AssetsService],
})
export class AssetsModule {}
