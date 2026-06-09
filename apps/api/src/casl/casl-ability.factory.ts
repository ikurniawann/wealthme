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
  | "Member"
  | "Notification"
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
        can("manage", "Category");
        can("manage", "Member");
        can("manage", "Notification");
        can("manage", "Transaction");
        break;

      case Role.member:
        can("read", "Account");
        can("read", "Category");
        can("read", "Member");
        can("manage", "Notification");
        can("manage", "Transaction");
        break;

      case Role.admin_staff:
        can("read", "Account");
        can("read", "Category");
        can("read", "Member");
        can("manage", "Notification");
        can("read", "Transaction");
        break;

      default:
        break;
    }

    return build();
  }
}
