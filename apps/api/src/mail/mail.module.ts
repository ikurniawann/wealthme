import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { TransactionalMailService } from "./transactional-mail.service";

@Module({
  imports: [ConfigModule],
  providers: [TransactionalMailService],
  exports: [TransactionalMailService],
})
export class MailModule {}
