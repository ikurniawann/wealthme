import { applyDecorators } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsNotEmpty } from "class-validator";

// E2E round 1, bug 1 — `@IsNotEmpty()` alone only rejects the literal empty
// string; a whitespace-only value ("   ") passed it untrimmed and was
// persisted as a visually-blank name (e.g. a goal saved with `name: ""`
// once the API trimmed it downstream, or a blank name showing in every
// list). Trim first, then reject the empty result — combine with
// `@IsString()` (and `@IsOptional()` on update DTOs) as usual.
export function IsTrimmedNotEmpty(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) =>
      typeof value === "string" ? value.trim() : value,
    ),
    IsNotEmpty(),
  );
}
