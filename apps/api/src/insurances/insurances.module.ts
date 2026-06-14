import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";

import { InsurancesController } from "./insurances.controller";
import { InsurancesService } from "./insurances.service";

@Module({
  imports: [PrismaModule],
  controllers: [InsurancesController],
  providers: [InsurancesService],
  exports: [InsurancesService],
})
export class InsurancesModule {}
