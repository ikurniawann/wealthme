import { Module } from "@nestjs/common";

import { MemberCategoryAllowancesController } from "./member-category-allowances.controller";
import { MemberCategoryAllowancesService } from "./member-category-allowances.service";

@Module({
  controllers: [MemberCategoryAllowancesController],
  providers: [MemberCategoryAllowancesService],
})
export class MemberCategoryAllowancesModule {}
