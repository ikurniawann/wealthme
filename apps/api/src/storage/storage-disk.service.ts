import { createReadStream } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { Injectable } from "@nestjs/common";
// ConfigService is injected by class reference — must stay a real import
// (see the same note in attachments.service.ts).
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from "@nestjs/config";

import { StoragePort, type StoredObject } from "./storage.port";

import type { Env } from "../config/env";

/**
 * EPIC-024 Task L1 (D15) — real `StoragePort` backed by local disk, rooted
 * at `STORAGE_DIR` (a persistent Docker volume — see docker-compose.yml's
 * `attachments_data` volume on the `api` service). Chosen over MinIO/S3 per
 * the epic's product decision ("stored on server disk ... S3 later without
 * feature changes"): callers only ever see the `StoragePort` interface, so
 * swapping this for an S3 adapter later is a binding change, not a feature
 * change.
 *
 * Every key is resolved through `resolveKey`, which refuses to produce a
 * path outside `root` — defense in depth against path traversal even though
 * the only current caller (AttachmentsService) always generates its own
 * UUID-based keys and never passes client-controlled input here directly.
 */
@Injectable()
export class StorageDiskService extends StoragePort {
  private readonly root: string;

  constructor(config: ConfigService<Env, true>) {
    super();
    this.root = resolve(config.get("STORAGE_DIR", { infer: true }));
  }

  // No per-family disk quota is enforced anywhere in the upload path — a
  // single family (or many families combined) can fill `STORAGE_DIR` and
  // `writeFile` will start failing with ENOSPC before any application-level
  // limit ever kicks in. This is a known, accepted gap explicitly flagged
  // (not silently fixed) per EPIC-024 Group L's adversarial-review scope —
  // a future task should add per-family storage quotas.
  async upload(
    key: string,
    buffer: Buffer,
    _mimeType: string,
  ): Promise<string> {
    const target = this.resolveKey(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, buffer);
    return key;
  }

  // Disk storage has no separate public origin to mint a real signed URL
  // for — callers stream bytes directly via `download()` (see
  // AttachmentsController's GET route) instead of redirecting to this URL.
  // Kept only for StoragePort parity so an S3 swap is a binding change.
  async getSignedUrl(key: string, _ttlSeconds = 3600): Promise<string> {
    this.resolveKey(key); // still validate — never echo an unvalidated key
    return `/storage/${key}`;
  }

  async download(key: string): Promise<NodeJS.ReadableStream> {
    const target = this.resolveKey(key);
    return createReadStream(target);
  }

  async delete(key: string): Promise<void> {
    const target = this.resolveKey(key);
    await rm(target, { force: true });
  }

  async list(prefix: string): Promise<StoredObject[]> {
    const base = this.resolveKey(prefix);
    let names: string[];
    try {
      names = await readdir(base, { recursive: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    const out: StoredObject[] = [];
    for (const name of names) {
      const full = resolve(base, name);
      const info = await stat(full);
      if (!info.isFile()) continue;
      out.push({
        key: relative(this.root, full).split("\\").join("/"),
        modifiedAt: info.mtime,
      });
    }
    return out;
  }

  async listChildren(prefix: string): Promise<string[]> {
    try {
      const entries = await readdir(this.resolveKey(prefix), {
        withFileTypes: true,
      });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  /** Resolves a storage key to an absolute path INSIDE `root`; throws for
   * any key that would resolve outside it (`..` segments, absolute paths,
   * etc). */
  private resolveKey(key: string): string {
    const target = resolve(this.root, key);
    const rel = relative(this.root, target);
    const escapesRoot =
      rel.startsWith("..") || resolve(this.root, rel) !== target;
    if (escapesRoot) {
      throw new Error(`Storage key resolves outside STORAGE_DIR: ${key}`);
    }
    return target;
  }
}
