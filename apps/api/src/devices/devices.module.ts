import { Module } from "@nestjs/common";

import { DevicesController } from "./devices.controller";
import { DevicesService } from "./devices.service";

// EPIC-023 D2 (US-FAM-13, D7) — device-bound PIN unlock. PrismaModule is
// @Global() (see prisma.module.ts) so it does not need to be listed here —
// matches AuthModule's own PasswordPolicyService, which injects
// PrismaService the same way without importing PrismaModule.
@Module({
  controllers: [DevicesController],
  providers: [DevicesService],
})
export class DevicesModule {}
