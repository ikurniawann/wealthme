import { FxInputService } from "../src/fx/fx-input.service";

import type { FxSnapshot } from "../src/fx/fx-snapshot";
import type { FxPort } from "../src/fx/fx.port";
import type { PrismaService } from "../src/prisma/prisma.service";

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
