import { Module } from "@nestjs/common";

import { StorageModule } from "../storage/storage.module";

import { AvatarsController } from "./avatars.controller";
import { AvatarsService } from "./avatars.service";

@Module({
  imports: [StorageModule],
  controllers: [AvatarsController],
  providers: [AvatarsService],
})
export class AvatarsModule {}
