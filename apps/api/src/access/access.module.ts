import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";

import { AccessController } from "./access.controller";
import { AccessService } from "./access.service";

@Module({
  imports: [PrismaModule],
  controllers: [AccessController],
  providers: [AccessService],
})
export class AccessModule {}
