import {
  ValidationPipe,
  type INestApplication,
  type Provider,
  type Type,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Role } from "@prisma/client";

import { FxInputService } from "../src/fx/fx-input.service";

import type { FxSnapshot } from "../src/fx/fx-snapshot";
import type { FxPort } from "../src/fx/fx.port";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { NextFunction, Request, Response } from "express";

export const TEST_SNAPSHOT: FxSnapshot = {
  source: "frankfurter",
  rateDate: "2026-09-25",
  fetchedAt: "2026-09-26T03:00:00.000Z",
  stale: false,
  idrPerUnit: {
    IDR: "1.000000",
    USD: "17913.899851",
    SGD: "14026.793930",
    EUR: "20427.220000",
    JPY: "113.674012",
    AUD: "12593.847102",
    CNY: "2668.445873",
  },
};

/** Real FxInputService over a fake FxPort + a fake prisma.fxConversion, for controller/service specs. */
export function fxTesting(snapshot: FxSnapshot = TEST_SNAPSHOT) {
  const fxPort = {
    getSnapshot: jest.fn().mockResolvedValue(snapshot),
    getRates: jest.fn(),
    getRate: jest.fn(),
  };
  const prisma = {
    fxConversion: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const service = new FxInputService(
    fxPort as unknown as FxPort,
    prisma as unknown as PrismaService,
  );
  return {
    fxPort,
    prisma,
    service,
    providers: [{ provide: FxInputService, useValue: service }],
  };
}

export const FG = "fg-1";

/** Controllers + mocked services + the real FxInputService over HTTP with the production ValidationPipe. */
export async function createFxTestApp(opts: {
  controllers: Type<unknown>[];
  providers: Provider[];
  fx: ReturnType<typeof fxTesting>;
  extraMiddleware?: (req: Request, res: Response, next: NextFunction) => void;
}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: opts.controllers,
    providers: [...opts.providers, ...opts.fx.providers],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const member = {
      id: "m-owner",
      userId: "u-owner",
      familyGroupId: FG,
      role: Role.owner,
      rowScoped: false,
      seesSharedAccounts: true,
    };
    req.tenantContext = {
      userId: "u-owner",
      familyGroupId: FG,
      role: Role.owner,
      member,
      access: null,
    };
    next();
  });
  if (opts.extraMiddleware) app.use(opts.extraMiddleware);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}
