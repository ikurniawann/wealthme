import { SetMetadata } from "@nestjs/common";

import type { AppAbility } from "../../casl/casl-ability.factory";

export const CHECK_ABILITY_KEY = "check_ability";

export type PolicyHandler = (ability: AppAbility) => boolean;

export const CheckAbility = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_ABILITY_KEY, handlers);
