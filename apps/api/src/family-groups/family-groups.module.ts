import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";

import { FamilyGroupsController } from "./family-groups.controller";
import { FamilyGroupsService } from "./family-groups.service";

@Module({
  imports: [PrismaModule],
  controllers: [FamilyGroupsController],
  providers: [FamilyGroupsService],
  exports: [FamilyGroupsService],
})
export class FamilyGroupsModule {}
