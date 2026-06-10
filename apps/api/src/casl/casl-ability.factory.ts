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
  | "Category"
  | "Liability"
  | "Transaction"
  | "Member"
  | "Budget"
  | "Goal"
  | "Notification"
  | "all";

export type AppAbility = MongoAbility<[Action, Subject]>;

@Injectable()
export class CaslAbilityFactory {
  createForMember(member: { role: Role }): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    switch (member.role) {
      case Role.owner:
        can("manage", "Account");
        can("manage", "Category");
        can("manage", "Liability");
        can("manage", "Transaction");
        can("manage", "Member");
        can("manage", "Budget");
        can("manage", "Goal");
        can("manage", "Notification");
        break;

      case Role.member:
        can("read", "Account");
        can("read", "Category");
        can("manage", "Liability");
        can("manage", "Transaction");
        can("read", "Member");
        can("manage", "Budget");
        can("manage", "Goal");
        can("read", "Notification");
        can("manage", "Notification");
        break;

      case Role.admin_staff:
        can("read", "Account");
        can("read", "Category");
        can("read", "Liability");
        can("read", "Transaction");
        can("read", "Member");
        can("read", "Budget");
        can("read", "Goal");
        can("read", "Notification");
        break;

      default:
        break;
    }

    return build();
  }
}
