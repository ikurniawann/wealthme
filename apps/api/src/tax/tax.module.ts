import { Module } from "@nestjs/common";

import { DonationsModule } from "../donations/donations.module";
import { PrismaModule } from "../prisma/prisma.module";

import { TaxController } from "./tax.controller";
import { TaxService } from "./tax.service";

@Module({
  imports: [PrismaModule, DonationsModule],
  controllers: [TaxController],
  providers: [TaxService],
  exports: [TaxService],
})
export class TaxModule {}
