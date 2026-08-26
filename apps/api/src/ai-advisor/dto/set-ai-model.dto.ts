import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

/**
 * The family's model choice.
 *
 * `null` (or omitted) is a real, meaningful value: it means "use whatever
 * WealthMe defaults to", which is how a family undoes a choice without
 * deleting their key.
 *
 * The id is NOT checked against a list of known models. Providers add models
 * constantly, and refusing one this server has not heard of would block a
 * model the family's key can genuinely use — the very staleness this feature
 * exists to avoid. It IS checked for shape, because it is interpolated into a
 * provider URL path: anything outside this character set could otherwise
 * escape the path segment.
 */
export class SetAiModelDto {
  @ApiPropertyOptional({
    example: "gemini-2.5-flash-lite",
    nullable: true,
    description: "Model id, or null to fall back to the WealthMe default",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, {
    message:
      "Model id boleh berisi huruf, angka, titik, titik dua, garis bawah dan strip saja.",
  })
  model?: string | null;
}
