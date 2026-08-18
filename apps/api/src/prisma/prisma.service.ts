import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { memberSoftDeleteExtension } from "./member-soft-delete.extension";

import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";

/**
 * NOTE: no `implements OnModuleInit, OnModuleDestroy` here, and no lifecycle
 * methods on the prototype. The constructor returns the EXTENDED client (see
 * below), which does not inherit from this class — prototype methods would be
 * dead code Nest never calls, a trap for anyone who later edits one and wonders
 * why nothing happens. The hooks Nest actually invokes are attached to the
 * returned object, typed by `PrismaServiceLifecycle` for the same guarantee the
 * `implements` clause used to give.
 */
type PrismaServiceLifecycle = OnModuleInit & OnModuleDestroy;

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    // Never log raw queries — they can carry PII (emails, tokens). Warn/error only.
    super({ log: ["warn", "error"] });

    // EPIC-027 A7 (D4) — every consumer injects `PrismaService` and calls
    // `this.prisma.member.*` directly, so the soft-delete filter has to live
    // on the object they hold. `$extends` returns a NEW client rather than
    // mutating this one, and returning an object from a constructor replaces
    // `this` — so the injected instance IS the extended client and there is no
    // second, unfiltered handle anyone could reach for by accident.
    // `$transaction` comes from that same client, so `tx.member` inside an
    // interactive transaction is filtered too.
    //
    // The cost of the swap: the returned value is not a `PrismaService`
    // instance, so Nest would not find the lifecycle hooks on its prototype.
    // They are attached explicitly below. (`$on`/`$use` are also unavailable
    // on an extended client — neither is used here; log configuration is
    // passed to the constructor above.)
    const extended = this.$extends(memberSoftDeleteExtension);

    const lifecycle: PrismaServiceLifecycle = {
      onModuleInit: async (): Promise<void> => {
        await extended.$connect();
      },
      onModuleDestroy: async (): Promise<void> => {
        // A failure during teardown must not block orderly shutdown.
        await extended.$disconnect().catch(() => undefined);
      },
    };
    Object.assign(extended, lifecycle);

    return extended as unknown as PrismaService;
  }
}
