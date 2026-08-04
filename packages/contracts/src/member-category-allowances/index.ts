import { z } from "zod";

// EPIC-019 Task C — owner-managed per-member expense category allow-list.
export const SetMemberCategoryAllowanceInputSchema = z.object({
  categoryIds: z.array(z.string().uuid()),
});
export type SetMemberCategoryAllowanceInput = z.infer<
  typeof SetMemberCategoryAllowanceInputSchema
>;

export const AllowedCategoryDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const MemberCategoryAllowanceDtoSchema = z.object({
  memberId: z.string(),
  // Empty = unrestricted (backward compatible default for every member).
  categories: z.array(AllowedCategoryDtoSchema),
});
export type MemberCategoryAllowanceDto = z.infer<
  typeof MemberCategoryAllowanceDtoSchema
>;
