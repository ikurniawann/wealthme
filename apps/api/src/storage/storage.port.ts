export abstract class StoragePort {
  abstract upload(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string>;
  abstract getSignedUrl(key: string, ttlSeconds?: number): Promise<string>;
  abstract delete(key: string): Promise<void>;
}
