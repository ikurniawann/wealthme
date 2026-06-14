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

  async delete(_key: string): Promise<void> {}
}
