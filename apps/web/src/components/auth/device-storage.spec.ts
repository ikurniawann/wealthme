/**
 * EPIC-023 D2 (US-FAM-13, D7) — device-storage localStorage helpers.
 */
import {
  clearStoredDevice,
  readAnyStoredDevice,
  readStoredDevice,
  writeStoredDevice,
} from "./device-storage";

describe("device-storage (EPIC-023 D2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when no device is stored for a user", () => {
    expect(readStoredDevice("user-1")).toBeNull();
  });

  it("round-trips a stored device for a user", () => {
    writeStoredDevice("user-1", { deviceId: "d1", deviceSecret: "s1" });
    expect(readStoredDevice("user-1")).toEqual({
      deviceId: "d1",
      deviceSecret: "s1",
    });
  });

  it("namespaces storage per userId — one user's binding never bleeds into another's read", () => {
    writeStoredDevice("user-1", { deviceId: "d1", deviceSecret: "s1" });
    expect(readStoredDevice("user-2")).toBeNull();
  });

  it("clearStoredDevice removes only the given user's binding", () => {
    writeStoredDevice("user-1", { deviceId: "d1", deviceSecret: "s1" });
    writeStoredDevice("user-2", { deviceId: "d2", deviceSecret: "s2" });

    clearStoredDevice("user-1");

    expect(readStoredDevice("user-1")).toBeNull();
    expect(readStoredDevice("user-2")).toEqual({
      deviceId: "d2",
      deviceSecret: "s2",
    });
  });

  it("readStoredDevice tolerates corrupted JSON without throwing", () => {
    window.localStorage.setItem("wm.device.user-1", "{not-json");
    expect(readStoredDevice("user-1")).toBeNull();
  });

  it("readStoredDevice tolerates a malformed shape (missing fields) without throwing", () => {
    window.localStorage.setItem(
      "wm.device.user-1",
      JSON.stringify({ deviceId: "only-this" }),
    );
    expect(readStoredDevice("user-1")).toBeNull();
  });

  it("readAnyStoredDevice finds a binding regardless of which user it belongs to", () => {
    writeStoredDevice("user-42", { deviceId: "dX", deviceSecret: "sX" });
    expect(readAnyStoredDevice()).toEqual({
      deviceId: "dX",
      deviceSecret: "sX",
    });
  });

  it("readAnyStoredDevice returns null when nothing is stored", () => {
    expect(readAnyStoredDevice()).toBeNull();
  });

  it("readAnyStoredDevice ignores unrelated localStorage keys", () => {
    window.localStorage.setItem("some-other-key", "unrelated-value");
    expect(readAnyStoredDevice()).toBeNull();
  });
});
