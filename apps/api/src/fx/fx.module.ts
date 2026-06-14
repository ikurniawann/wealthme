import { Module } from "@nestjs/common";

import { FxMockService } from "./fx-mock.service";
import { FxController } from "./fx.controller";
import { FxPort } from "./fx.port";

@Module({
  controllers: [FxController],
  providers: [{ provide: FxPort, useClass: FxMockService }],
  exports: [FxPort],
})
export class FxModule {}
