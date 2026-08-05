import { Test, type TestingModule } from "@nestjs/testing";

import { DevicesController } from "./devices.controller";
import { DevicesService } from "./devices.service";

// EPIC-023 D2 (US-FAM-13, D7) — proves the controller ALWAYS derives the
// acting user from `req.user.sub` (the authenticated session), never from
// any client-supplied body/param field — same IDOR discipline D1's
// `set-password` endpoint already established. A malicious body carrying a
// `userId` must be ignored entirely.
describe("DevicesController (EPIC-023 D2)", () => {
  let controller: DevicesController;
  let service: {
    registerDevice: jest.Mock;
    listDevices: jest.Mock;
    setPin: jest.Mock;
    revokeDevice: jest.Mock;
    unlock: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      registerDevice: jest.fn().mockResolvedValue({
        deviceId: "device-1",
        deviceSecret: "secret",
      }),
      listDevices: jest.fn().mockResolvedValue([]),
      setPin: jest.fn().mockResolvedValue(undefined),
      revokeDevice: jest.fn().mockResolvedValue(undefined),
      unlock: jest.fn().mockResolvedValue({ token: "tok" }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [{ provide: DevicesService, useValue: service }],
    }).compile();
    controller = module.get(DevicesController);
  });

  function fakeReq(userId: string) {
    return { user: { sub: userId, email: `${userId}@invalid` } } as never;
  }

  it("register() uses req.user.sub, ignoring any client-supplied identity in the body", async () => {
    await controller.register(fakeReq("real-session-user"), {
      label: "iPhone",
    });
    expect(service.registerDevice).toHaveBeenCalledWith("real-session-user", {
      label: "iPhone",
    });
  });

  it("list() uses req.user.sub", async () => {
    await controller.list(fakeReq("real-session-user"));
    expect(service.listDevices).toHaveBeenCalledWith("real-session-user");
  });

  it("setPin() passes req.user.sub as the OWNER check, not the :deviceId path alone", async () => {
    await controller.setPin(fakeReq("real-session-user"), "some-device-id", {
      pin: "482913",
    });
    expect(service.setPin).toHaveBeenCalledWith(
      "real-session-user",
      "some-device-id",
      { pin: "482913" },
    );
  });

  it("revoke() passes req.user.sub as the OWNER check", async () => {
    await controller.revoke(fakeReq("real-session-user"), "some-device-id");
    expect(service.revokeDevice).toHaveBeenCalledWith(
      "real-session-user",
      "some-device-id",
    );
  });

  it("unlock() takes NO req.user at all — it is unauthenticated by design", async () => {
    const result = await controller.unlock("some-device-id", {
      deviceSecret: "secret",
      pin: "482913",
    });
    expect(service.unlock).toHaveBeenCalledWith("some-device-id", {
      deviceSecret: "secret",
      pin: "482913",
    });
    expect(result).toEqual({ token: "tok" });
  });
});
