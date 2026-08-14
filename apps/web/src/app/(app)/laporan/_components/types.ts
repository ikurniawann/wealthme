import type { Role } from "@wealthme/contracts";

/** Family group member (mirrors API MemberResponseDto). */
export type FamilyMember = {
  id: string;
  userId: string;
  familyGroupId: string;
  role: Role;
  name: string;
  email: string;
  createdAt: string;
};

export type CoaAccountOption = { id: string; code: string; name: string };
