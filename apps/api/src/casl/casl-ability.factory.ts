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
  | "Asset"
  | "Budget"
  | "Category"
  | "Donation"
  | "FamilyGroup"
  | "Goal"
  | "Inheritance"
  | "Insurance"
  | "Investment"
  | "Liability"
  | "Member"
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
        can("manage", "Asset");
        can("manage", "Category");
        can("manage", "Liability");
        can("manage", "Transaction");
        can("manage", "Member");
        can("manage", "Budget");
        can("manage", "Goal");
        can("manage", "Insurance");
        can("manage", "Notification");
        can("manage", "Investment");
        break;

      case Role.member:
        can("read", "Account");
        can("manage", "Asset");
        can("read", "Category");
        can("manage", "Liability");
        can("manage", "Transaction");
        can("read", "Member");
        can("manage", "Budget");
        can("manage", "Goal");
        can("manage", "Insurance");
        can("read", "Notification");
        can("manage", "Notification");
        can("manage", "Investment");
        break;

      case Role.admin_staff:
        can("read", "Account");
        can("read", "Asset");
        can("read", "Budget");
        can("read", "Category");
        can("read", "Goal");
        can("read", "Insurance");
        can("read", "Investment");
        can("read", "Liability");
        can("read", "Member");
        can("read", "Notification");
        can("create", "Transaction");
        can("read", "Transaction");
        break;

      default:
        break;
    }

    return build();
  }
}
