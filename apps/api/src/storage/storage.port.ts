export abstract class StoragePort {
  abstract upload(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string>;
  abstract getSignedUrl(key: string, ttlSeconds?: number): Promise<string>;
  // EPIC-024 Task L1 (D15) — added alongside StorageDiskService so a
  // streamed GET (L2) can read bytes back without callers reaching around
  // the port to poke the filesystem directly. A future S3-backed
  // implementation can still satisfy this by streaming the object body.
  abstract download(key: string): Promise<NodeJS.ReadableStream>;
  abstract delete(key: string): Promise<void>;
}
