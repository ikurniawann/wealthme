import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MemberRelationship, Role } from "@prisma/client";

export class MemberResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  userId!: string;

  @ApiProperty({ type: String })
  familyGroupId!: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  // EPIC-023 Task C (D1) — purely descriptive kinship; null for every
  // pre-existing member.
  @ApiPropertyOptional({ enum: MemberRelationship, nullable: true })
  relationship!: MemberRelationship | null;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  email!: string;

  // Login username — set only for head-created accounts (see managedLogin).
  @ApiPropertyOptional({ type: String, nullable: true })
  username!: string | null;

  // True when the head created this login from /iam (username + initial
  // password, no real mailbox). Only such a member's password can be set by
  // a Master — everyone else recovers theirs via "Lupa Password".
  @ApiProperty({ type: Boolean })
  managedLogin!: boolean;

  // EPIC-031 — an email the Master entered that its owner has not confirmed
  // yet (it cannot be used to sign in until then).
  @ApiPropertyOptional({ type: String, nullable: true })
  pendingEmail!: string | null;

  // EPIC-030 — IAM assignment (only populated by the roster endpoint).
  @ApiPropertyOptional({ type: String, nullable: true })
  accessRoleId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  accessRoleName?: string | null;

  @ApiPropertyOptional({
    enum: ["all", "own"],
    description:
      "Effective data scope: own = sees only rows they own or that were shared with them",
  })
  dataScope?: "all" | "own";

  @ApiPropertyOptional({
    type: Object,
    description: "Per-member page overrides (page → none|view|manage)",
  })
  accessOverrides?: Record<string, string>;

  // "Lihat saldo" (roster endpoint only). Ignored for owner/spouse.
  @ApiPropertyOptional({ type: Boolean })
  canViewBalances?: boolean;

  // EPIC-023 Task D (D3/D9, US-FAM-14) — per-member large-transaction
  // threshold, as string (BigInt-safe). Null = no gate (every pre-existing
  // member, backward compatible). Only meaningful for a row-scoped role
  // (dependant/operational) — see schema.prisma's Member comment.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Per-member large-transaction threshold (IDR minor units)",
  })
  largeTxnThreshold!: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;
}
