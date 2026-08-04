import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from "@casl/ability";
import { Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";

export type Action = "manage" | "create" | "read" | "update" | "delete";
export type Subject =
  | "Account"
  | "AllowanceRequest"
  | "Asset"
  | "Budget"
  | "Category"
  | "CoaAccount"
  | "Donation"
  | "FamilyGroup"
  | "Goal"
  | "Inheritance"
  | "Insurance"
  | "Investment"
  | "Liability"
  | "Member"
  | "MemberCategoryAllowance"
  | "Notification"
  | "Report"
  | "SplitBill"
  | "TaxRecord"
  | "Transaction"
  | "all";

export type AppAbility = MongoAbility<[Action, Subject]>;

@Injectable()
export class CaslAbilityFactory {
  createForMember(member: { role: Role }): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    switch (member.role) {
      case Role.owner:
        can("manage", "Account");
        can("manage", "AllowanceRequest");
        can("manage", "Asset");
        can("manage", "Budget");
        can("manage", "Category");
        can("manage", "CoaAccount");
        can("manage", "Donation");
        can("manage", "Goal");
        can("manage", "Inheritance");
        can("manage", "Insurance");
        can("manage", "Investment");
        can("manage", "Liability");
        can("manage", "Member");
        can("manage", "MemberCategoryAllowance");
        can("manage", "Notification");
        can("manage", "TaxRecord");
        can("manage", "Transaction");
        break;

      case Role.member:
        can("read", "Account");
        // EPIC-019 Task B — a member may file/read their own allowance
        // requests; only an owner may approve/reject (see "manage" above).
        can("create", "AllowanceRequest");
        can("read", "AllowanceRequest");
        can("manage", "Asset");
        can("manage", "Budget");
        can("read", "Category");
        can("read", "CoaAccount");
        can("manage", "Donation");
        can("manage", "Goal");
        can("manage", "Inheritance");
        can("manage", "Insurance");
        can("manage", "Investment");
        can("manage", "Liability");
        can("read", "Member");
        // EPIC-019 Task C — a member may see their own category allow-list;
        // only an owner may set it (see "manage" above).
        can("read", "MemberCategoryAllowance");
        can("manage", "Notification");
        can("read", "Notification");
        can("manage", "TaxRecord");
        can("manage", "Transaction");
        break;

      case Role.admin_staff:
        can("read", "Account");
        can("create", "AllowanceRequest");
        can("read", "AllowanceRequest");
        can("read", "Asset");
        can("read", "Budget");
        can("read", "Category");
        can("read", "CoaAccount");
        can("read", "Donation");
        can("read", "Goal");
        can("read", "Inheritance");
        can("read", "Insurance");
        can("read", "Investment");
        can("read", "Liability");
        can("read", "Member");
        can("read", "MemberCategoryAllowance");
        can("read", "Notification");
        can("read", "TaxRecord");
        can("create", "Transaction");
        can("read", "Transaction");
        break;

      default:
        break;
    }

    return build();
  }
}
