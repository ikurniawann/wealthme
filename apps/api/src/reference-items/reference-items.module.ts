import { Module } from "@nestjs/common";

import { ReferenceItemsController } from "./reference-items.controller";
import { ReferenceItemsService } from "./reference-items.service";

@Module({
  controllers: [ReferenceItemsController],
  providers: [ReferenceItemsService],
  exports: [ReferenceItemsService],
})
export class ReferenceItemsModule {}
