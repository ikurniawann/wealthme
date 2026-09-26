import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";

import { CaslAbilityFactory } from "../../casl/casl-ability.factory";
import { AbilitiesGuard } from "../../common/guards/abilities.guard";

import type { INestApplication, Provider, Type } from "@nestjs/common";
import type { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";

export const FAMILY_GROUP_ID = "fg-1";

export async function buildTaxTestApp(opts: {
  controllers: Type[];
  providers: Provider[];
}) {
  let role: Role | null = "owner";
  const moduleRef = await Test.createTestingModule({
    controllers: opts.controllers,
    providers: [
      ...opts.providers,
      CaslAbilityFactory,
      { provide: APP_GUARD, useClass: AbilitiesGuard },
    ],
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.tenantContext = role
      ? {
          userId: `u-${role}`,
          familyGroupId: FAMILY_GROUP_ID,
          role,
          member: {
            id: `m-${role}`,
            userId: `u-${role}`,
            familyGroupId: FAMILY_GROUP_ID,
            role,
            rowScoped: false,
            seesSharedAccounts: false,
          },
          access: null,
        }
      : undefined;
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return {
    app,
    setRole: (r: Role | null) => {
      role = r;
    },
  };
}
