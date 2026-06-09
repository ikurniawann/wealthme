import { Module } from "@nestjs/common";

import { CaslModule } from "../casl/casl.module";

import { AbilitiesGuard } from "./guards/abilities.guard";
import { TenantGuard } from "./guards/tenant.guard";

@Module({
  imports: [CaslModule],
  providers: [TenantGuard, AbilitiesGuard],
  exports: [TenantGuard, AbilitiesGuard],
})
export class CommonModule {}
