import "reflect-metadata";

import { AuthController } from "./auth.controller";

// @nestjs/throttler does not export its metadata key constants from the
// package root; these match throttler.constants.ts verbatim.
const THROTTLER_LIMIT = "THROTTLER:LIMIT";
const THROTTLER_TTL = "THROTTLER:TTL";

describe("AuthController throttle metadata", () => {
  it("limits changePassword to 5 requests per 60s (default tracker)", () => {
    const handler = AuthController.prototype.changePassword;
    expect(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler)).toBe(5);
    expect(Reflect.getMetadata(`${THROTTLER_TTL}default`, handler)).toBe(60000);
  });
});
