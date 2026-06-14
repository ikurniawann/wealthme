import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";

import { SplitBillsController } from "./split-bills.controller";
import { SplitBillsService } from "./split-bills.service";

@Module({
  imports: [PrismaModule],
  controllers: [SplitBillsController],
  providers: [SplitBillsService],
  exports: [SplitBillsService],
})
export class SplitBillsModule {}
