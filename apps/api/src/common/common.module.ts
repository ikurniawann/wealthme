import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";

import { CaslModule } from "../casl/casl.module";

import { AbilitiesGuard } from "./guards/abilities.guard";
import { TenantGuard } from "./guards/tenant.guard";
import { RequestIdMiddleware } from "./middleware/request-id.middleware";

@Module({
  imports: [CaslModule],
  providers: [TenantGuard, AbilitiesGuard, RequestIdMiddleware],
  exports: [TenantGuard, AbilitiesGuard],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
