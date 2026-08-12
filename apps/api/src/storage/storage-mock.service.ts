import { Readable } from "node:stream";

import { Injectable } from "@nestjs/common";

import { StoragePort } from "./storage.port";

@Injectable()
export class StorageMockService extends StoragePort {
  async upload(
    key: string,
    _buffer: Buffer,
    _mimeType: string,
  ): Promise<string> {
    return `/mock-storage/${key}`;
  }

  async getSignedUrl(key: string, _ttlSeconds = 3600): Promise<string> {
    return `/mock-storage/${key}?signed=true`;
  }

  async download(_key: string): Promise<NodeJS.ReadableStream> {
    return Readable.from(Buffer.alloc(0));
  }

  async delete(_key: string): Promise<void> {}
}
