import { applyDecorators } from "@nestjs/common";
import { IsString, Length, Matches } from "class-validator";

// Better Auth generates its own opaque id (e.g. "Yyyw1LCqJDZhOJ00qNCfjxfHhH2P7uCs")
// for every self-registered account; only Prisma-seeded User rows get
// @default(uuid()). Use this instead of @IsUUID() on any field/param that
// holds a User.id — accountId/categoryId/etc. (app-generated entity ids)
// should keep @IsUUID().
export function IsUserId(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    Length(1, 64),
    Matches(/^[A-Za-z0-9_-]+$/),
  );
}
