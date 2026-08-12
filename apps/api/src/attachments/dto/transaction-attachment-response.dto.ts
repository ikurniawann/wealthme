import { ApiProperty } from "@nestjs/swagger";

export class TransactionAttachmentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() transactionId!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() size!: number;
  @ApiProperty() createdAt!: string;
  // NOTE: intentionally NO `path` field — the storage key is an internal
  // detail (see StorageDiskService); the file is only ever reachable via
  // the tenant-scoped GET route below, never by a client-guessable path.
}
