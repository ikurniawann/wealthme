import { Module } from "@nestjs/common";

import { StorageMockService } from "./storage-mock.service";
import { StoragePort } from "./storage.port";

@Module({
  providers: [{ provide: StoragePort, useClass: StorageMockService }],
  exports: [StoragePort],
})
export class StorageModule {}
