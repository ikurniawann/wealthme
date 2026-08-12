import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { StorageDiskService } from "./storage-disk.service";
import { StoragePort } from "./storage.port";

// EPIC-024 Task L1 (D15) — swapped from StorageMockService (which never
// persisted anything) to the real disk-backed implementation. Root path
// comes from STORAGE_DIR (see config/env.ts), a persistent Docker volume in
// docker-compose.yml. StorageMockService is kept in the tree only for unit
// tests that need a StoragePort double.
@Module({
  imports: [ConfigModule],
  providers: [{ provide: StoragePort, useClass: StorageDiskService }],
  exports: [StoragePort],
})
export class StorageModule {}
