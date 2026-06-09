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
  | "Budget"
  | "Category"
  | "Transaction"
  | "Member"
  | "all";

export type AppAbility = MongoAbility<[Action, Subject]>;

@Injectable()
export class CaslAbilityFactory {
  createForMember(member: { role: Role }): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    switch (member.role) {
      case Role.owner:
        can("manage", "Account");
        can("manage", "Budget");
        can("manage", "Category");
        can("manage", "Transaction");
        can("manage", "Member");
        break;

      case Role.member:
        can("read", "Account");
        can("manage", "Budget");
        can("read", "Category");
        can("manage", "Transaction");
        can("read", "Member");
        break;

      case Role.admin_staff:
        can("read", "Account");
        can("read", "Budget");
        can("read", "Category");
        can("read", "Transaction");
        can("read", "Member");
        break;

      default:
        break;
    }

    return build();
  }
}
