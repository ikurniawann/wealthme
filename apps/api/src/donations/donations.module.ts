import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";

import { DonationsController } from "./donations.controller";
import { DonationsService } from "./donations.service";

@Module({
  imports: [PrismaModule],
  controllers: [DonationsController],
  providers: [DonationsService],
  exports: [DonationsService],
})
export class DonationsModule {}
