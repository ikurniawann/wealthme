import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";

import { AntamGoldPriceClient } from "./antam-gold-price.client";
import { AntamGoldPriceService } from "./antam-gold-price.service";
import { GoldPriceController } from "./gold-price.controller";

@Module({
  imports: [PrismaModule],
  controllers: [GoldPriceController],
  providers: [AntamGoldPriceClient, AntamGoldPriceService],
  exports: [AntamGoldPriceService],
})
export class GoldPriceModule {}
