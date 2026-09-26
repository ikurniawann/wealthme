import { Injectable, Logger } from "@nestjs/common";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import {
  applyFxOverrides,
  resolveFxInputs,
  type FxFieldSpec,
  type FxInputLike,
  type PendingFxConversion,
} from "./fx-input.resolve";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FxPort } from "./fx.port";

export type FxEntity =
  | "Account"
  | "Transaction"
  | "AllowanceRequest"
  | "Budget"
  | "Goal"
  | "GoalContribution"
  | "Asset"
  | "Investment"
  | "Liability"
  | "Insurance"
  | "InheritanceAsset"
  | "Donation"
  | "SplitBill"
  | "FamilyGroup"
  | "Member";

export interface FxTarget {
  entity: FxEntity;
  entityId: string;
}

export interface FxRunArgs<TDto extends { fxInputs?: FxInputLike[] }, TResult> {
  familyGroupId: string;
  userId: string | null;
  entity: FxEntity;
  /** Set for PATCH / action routes; otherwise the result's `id` is used. */
  entityId?: string;
  /** Action routes record `pay.amount`, `trade.pricePerUnit`, … */
  fieldPrefix?: string;
  locate?: (result: TResult) => FxTarget;
  transform?: (dto: Omit<TDto, "fxInputs">) => Omit<TDto, "fxInputs">;
  dto: TDto;
  spec: FxFieldSpec;
}

function idOf(result: unknown): string | null {
  if (typeof result === "object" && result !== null && "id" in result) {
    const id = (result as { id: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

@Injectable()
export class FxInputService {
  private readonly logger = new Logger(FxInputService.name);

  constructor(
    private readonly fx: FxPort,
    private readonly prisma: PrismaService,
  ) {}

  async run<TDto extends { fxInputs?: FxInputLike[] }, TResult>(
    args: FxRunArgs<TDto, TResult>,
    persist: (dto: Omit<TDto, "fxInputs">) => Promise<TResult>,
  ): Promise<TResult> {
    const { fxInputs, ...rest } = args.dto;
    if (!fxInputs || fxInputs.length === 0) return persist(rest);

    const snapshot = await this.fx.getSnapshot();
    const { overrides, pending } = resolveFxInputs(
      fxInputs,
      args.spec,
      snapshot,
    );
    const converted = applyFxOverrides(rest, overrides);
    const result = await persist(
      args.transform ? args.transform(converted) : converted,
    );

    const target = args.locate
      ? args.locate(result)
      : { entity: args.entity, entityId: args.entityId ?? idOf(result) };
    await this.record(args, target, pending);
    return result;
  }

  private async record<TDto extends { fxInputs?: FxInputLike[] }, TResult>(
    args: FxRunArgs<TDto, TResult>,
    target: { entity: FxEntity; entityId: string | null },
    pending: PendingFxConversion[],
  ): Promise<void> {
    const context = JSON.stringify({
      familyGroupId: args.familyGroupId,
      ...target,
      pending,
    });
    if (!target.entityId) {
      this.logger.error(
        `fx_conversions insert failed after commit: no entity id`,
        context,
      );
      return;
    }
    try {
      await this.prisma.fxConversion.createMany({
        data: pending.map((p) => ({
          familyGroupId: args.familyGroupId,
          entity: target.entity,
          entityId: target.entityId!,
          field: args.fieldPrefix ? `${args.fieldPrefix}.${p.field}` : p.field,
          originalAmount: p.originalAmount,
          originalCurrency: p.originalCurrency,
          idrAmount: p.idrAmount,
          idrPerUnit: p.idrPerUnit,
          rateDate: new Date(`${p.rateDate}T00:00:00.000Z`),
          rateSource: p.rateSource,
          rateStale: p.rateStale,
          createdByUserId: args.userId,
        })),
      });
    } catch (err) {
      this.logger.error(
        `fx_conversions insert failed after commit ${context}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
