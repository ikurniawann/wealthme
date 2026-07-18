import { Module } from "@nestjs/common";

import { CoaAccountsController } from "./coa-accounts.controller";
import { CoaAccountsService } from "./coa-accounts.service";

@Module({
  controllers: [CoaAccountsController],
  providers: [CoaAccountsService],
  exports: [CoaAccountsService],
})
export class CoaAccountsModule {}
