import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { StorageDiskService } from "./storage-disk.service";
import { StoragePort } from "./storage.port";

// EPIC-024 Task L1 (D15) — swapped from a mock (which never persisted
// anything) to the real disk-backed implementation. Root path comes from
// STORAGE_DIR (see config/env.ts), a persistent Docker volume in
// docker-compose.yml. The old `StorageMockService` was deleted once it turned
// out no test ever instantiated it — a `StoragePort` double belongs in the
// spec that needs it, not shipped in the production bundle.
@Module({
  imports: [ConfigModule],
  providers: [{ provide: StoragePort, useClass: StorageDiskService }],
  exports: [StoragePort],
})
export class StorageModule {}
