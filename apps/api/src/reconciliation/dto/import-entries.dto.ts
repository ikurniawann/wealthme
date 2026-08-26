import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

/**
 * Turning a reconciliation line into a real Transaction.
 *
 * Reconciliation could only ever MATCH a bank line against a transaction that
 * already existed. If the family had not typed the transaction in first,
 * every line stayed red "Tidak Ditemukan" and importing a statement wrote
 * nothing to `/transaksi` — which is not what "impor mutasi" means to anyone
 * reading the screen.
 *
 * What the bank line cannot tell us is where the money sits and what it was
 * for, so those come from the user:
 *
 *  - `accountId` — required. The account the statement belongs to.
 *  - `categoryId` — optional, and deliberately so. A statement description
 *    ("TRSF E-BANKING CR") is not a category, and guessing one would write a
 *    wrong number into every budget and report that reads it. Uncategorised
 *    is honest; a fabricated category is not.
 *
 * The direction is NOT asked for: the sign on the bank line already carries
 * it, and asking would invite an answer that contradicts the statement.
 */
export class ImportEntriesDto {
  @ApiProperty({ type: String, description: "Account UUID to import into" })
  @IsUUID()
  accountId!: string;

  @ApiPropertyOptional({
    type: String,
    description: "Optional category UUID applied to every imported row",
  })
  @IsUUID()
  @IsOptional()
  categoryId?: string;
}
