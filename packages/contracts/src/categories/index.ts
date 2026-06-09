import { z } from "zod";

export const CategoryKindSchema = z.enum(["income", "expense"]);
export type CategoryKind = z.infer<typeof CategoryKindSchema>;

export const CategoryDtoSchema = z.object({
  id: z.string().uuid(),
  familyGroupId: z.string().uuid(),
  name: z.string(),
  kind: CategoryKindSchema,
  color: z.string().nullable(),
  icon: z.string().nullable(),
  createdAt: z.string(),
});
export type CategoryDto = z.infer<typeof CategoryDtoSchema>;
