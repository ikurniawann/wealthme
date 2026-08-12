import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { StorageDiskService } from "./storage-disk.service";

function makeService(root: string): StorageDiskService {
  const config = { get: () => root };
  return new StorageDiskService(config as never);
}

describe("StorageDiskService", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "wealthme-storage-test-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes and reads back a file under a nested key", async () => {
    const service = makeService(root);
    const key = "fg-1/tx-1/abc.jpg";
    await service.upload(key, Buffer.from("hello"), "image/jpeg");

    const written = await readFile(join(root, key));
    expect(written.toString()).toBe("hello");
  });

  it("REFUSES a key that traverses out of the storage root via '..'", async () => {
    const service = makeService(root);
    const maliciousKey = "../../../etc/passwd";

    await expect(
      service.upload(maliciousKey, Buffer.from("pwned"), "image/jpeg"),
    ).rejects.toThrow(/resolves outside STORAGE_DIR/);
  });

  it("REFUSES a key that is an absolute path outside the root", async () => {
    const service = makeService(root);

    await expect(
      service.upload("/etc/passwd", Buffer.from("pwned"), "image/jpeg"),
    ).rejects.toThrow(/resolves outside STORAGE_DIR/);
  });

  it("REFUSES download() for a traversal key", async () => {
    const service = makeService(root);

    await expect(service.download("../secret.txt")).rejects.toThrow(
      /resolves outside STORAGE_DIR/,
    );
  });

  it("REFUSES delete() for a traversal key", async () => {
    const service = makeService(root);

    await expect(service.delete("../../secret.txt")).rejects.toThrow(
      /resolves outside STORAGE_DIR/,
    );
  });

  it("deletes a stored file", async () => {
    const service = makeService(root);
    const key = "fg-1/tx-1/abc.jpg";
    await service.upload(key, Buffer.from("hello"), "image/jpeg");

    await service.delete(key);

    await expect(readFile(join(root, key))).rejects.toThrow();
  });
});
