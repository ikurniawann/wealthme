import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";

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
  // Revisi K review fix 2 — `null` lets a `locate` deliberately skip the
  // audit (e.g. an idempotent replay that wrote nothing); `record()` already
  // treats a falsy entityId as "nothing to attach to" below.
  entityId: string | null;
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
    // I2 (user decision) — an indicative snapshot (provider down AND no
    // stored fx_rates, or FX_PROVIDER=mock) is not a real rate: refuse the
    // write rather than convert against a placeholder table. Display/preview
    // may still show the labelled indicative table; only a persisting write
    // is refused, and only here, the single choke point every fxInputs write
    // passes through.
    if (snapshot.source === "indicative") {
      // Revisi K bug 2 — the web app used to map EVERY 503 to this FX
      // refusal toast by matching on HTTP status alone (several distinct
      // failures can share 503). `code` lets it match on THIS specific
      // refusal instead, mirroring devices.service.ts's DEVICE_LOCKED body.
      throw new ServiceUnavailableException({
        message:
          "fxInputs: FX rate is indicative only, not a live rate — choose IDR or try again",
        code: "FX_RATE_UNAVAILABLE",
      });
    }
    const { overrides, pending } = resolveFxInputs(
      fxInputs,
      args.spec,
      snapshot,
    );
    const converted = applyFxOverrides(rest, overrides);
    const result = await persist(
      args.transform ? args.transform(converted) : converted,
    );

    let target: FxTarget | { entity: FxEntity; entityId: string | null };
    try {
      target = args.locate
        ? args.locate(result)
        : { entity: args.entity, entityId: args.entityId ?? idOf(result) };
    } catch (err) {
      // persist() already committed — a throw here must never surface as an
      // error to the caller (it would trigger a duplicate-write retry).
      this.logger.error(
        `fx_conversions insert failed after commit: locate() threw`,
        err instanceof Error ? err.stack : String(err),
      );
      return result;
    }
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
