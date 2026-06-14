import { Module } from "@nestjs/common";

import { CalculatorsController } from "./calculators.controller";
import { CalculatorsService } from "./calculators.service";

@Module({
  controllers: [CalculatorsController],
  providers: [CalculatorsService],
})
export class CalculatorsModule {}
