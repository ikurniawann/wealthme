import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";

import { InheritanceController } from "./inheritance.controller";
import { InheritanceService } from "./inheritance.service";

@Module({
  imports: [PrismaModule],
  controllers: [InheritanceController],
  providers: [InheritanceService],
  exports: [InheritanceService],
})
export class InheritanceModule {}
