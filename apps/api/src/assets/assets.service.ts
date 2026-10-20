import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { type Decimal } from "@prisma/client/runtime/library";

import { runSerializableWithRetry } from "../common/utils/serializable-retry.util";
import { dbDateToYmd } from "../investments/ledger/ledger-dates";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import { viewerAssetWhere } from "./asset-access";
import {
  detailsColumn,
  detailsForUpdate,
  detailsOut,
  planOpening,
  resolveCreateOwner,
  writeOpening,
} from "./asset-create";
import {
  historyEffectiveFields,
  nowEffectiveFields,
} from "./history-effective.util";
import {
  loadState,
  lockAsset,
  timelineOf,
  userNames,
} from "./ledger/asset-ledger-support";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AssetValuationsService } from "./ledger/asset-valuations.service";

import type { AssetViewer } from "./asset-access";
import type {
  AssetHistoryResponseDto,
  AssetResponseDto,
} from "./dto/asset-response.dto";
import type { CreateAssetDto } from "./dto/create-asset.dto";
import type { RecordAssetValueDto } from "./dto/record-asset-value.dto";
import type { UpdateAssetDto } from "./dto/update-asset.dto";
import type { Asset, AssetValuationModel } from "@prisma/client";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

const MIN_RATE_PCT = -100;
const MAX_RATE_PCT = 100;

/**
 * EPIC-023 Task H1 review (HIGH fix 1): Indonesia Western Time — fixed
 * UTC+7, no daylight saving. Mirrors `wibWallClockToIso`/`wibCalendarParts`
 * in `apps/web/src/lib/laporan-period.ts` (EPIC-022 B7) and
 * `defaultMonthStartWib` in `reports.controller.ts` (EPIC-023 Task B3
 * review, fix 6) — duplicated here (not imported; `apps/web/src/lib` is a
 * protected foundation file and this package cannot depend on it anyway)
 * because this app is Rupiah/Indonesia-focused and comparing raw instants
 * is wrong for a calendar-date field like acquisitionDate: `new
 * Date("2026-08-05")` parses as UTC midnight, which is still ~7h in the
 * FUTURE relative to `Date.now()` for the first 7 hours of every WIB day
 * (9h for WIT) — rejecting a perfectly valid "today" acquisition date for a
 * chunk of every single day. DO NOT simplify this back to
 * `parsed.getTime() > Date.now()`.
 */
const WIB_UTC_OFFSET_MINUTES = 7 * 60;

/** UTC-midnight-anchored "today" in WIB wall-clock terms, for calendar-date comparisons. */
function wibTodayUtcMidnight(now: Date): Date {
  const wibNow = new Date(now.getTime() + WIB_UTC_OFFSET_MINUTES * 60_000);
  const utcMs = Date.UTC(
    wibNow.getUTCFullYear(),
    wibNow.getUTCMonth(),
    wibNow.getUTCDate(),
  );
  return new Date(utcMs);
}

/** EPIC-024 D2/US-ASSET-6: mirrors the Prisma `AssetValueChangeMode` enum. */
export type AssetValueChangeMode = "percent" | "fixed";

/**
 * Pro-rata, compute-on-read estimate of an asset's current value.
 *
 * - `mode: "percent"` (default, matches all pre-EPIC-024 assets): signed
 *   annual value-change rate (negative = depreciation, positive =
 *   appreciation). Linear approximation: currentValue × (1 + rate/100 ×
 *   yearsElapsed), floored at 0.
 * - `mode: "fixed"` (D11/US-ASSET-6): signed Rp/year delta instead of a
 *   rate — same sign convention (negative = depreciation, positive =
 *   appreciation). Linear approximation: currentValue + amount ×
 *   yearsElapsed, floored at 0.
 *
 * `since` is the asset's acquisition date when set (EPIC-023 D19/US-ASSET-4),
 * falling back to `createdAt` for legacy assets that predate the field
 * (EPIC-021 Open Design Decision #8).
 */
export function computeEstimatedValue(
  currentValue: bigint,
  ratePct: Decimal | null,
  since: Date,
  now: Date = new Date(),
  mode: AssetValueChangeMode = "percent",
  amount: bigint | null = null,
): bigint {
  const yearsElapsed =
    Math.max(now.getTime() - since.getTime(), 0) / MS_PER_YEAR;

  if (mode === "fixed") {
    if (amount == null || amount === 0n) return currentValue;
    const estimated = Math.round(
      Number(currentValue) + Number(amount) * yearsElapsed,
    );
    return BigInt(Math.max(estimated, 0));
  }

  if (!ratePct || ratePct.isZero()) return currentValue;
  const multiplier = 1 + (ratePct.toNumber() / 100) * yearsElapsed;
  const estimated = Math.round(Number(currentValue) * multiplier);
  return BigInt(Math.max(estimated, 0));
}

function toAssetDto(asset: Asset): AssetResponseDto {
  return {
    id: asset.id,
    familyGroupId: asset.familyGroupId,
    name: asset.name,
    type: asset.type,
    currentValue: asset.currentValue.toString(),
    currency: asset.currency,
    notes: asset.notes,
    // Aset fields (2026-10-20) — the identity columns the web reads (owner,
    // model, unit, …) were never serialised: the detail page showed every
    // asset as Bersama and the edit form reset per-unit assets to total.
    investmentId: asset.investmentId,
    ownerUserId: asset.ownerUserId,
    quantity: asset.quantity?.toString() ?? null,
    unit: asset.unit,
    valuationModel: asset.valuationModel,
    costBasisPerUnit: asset.costBasisPerUnit?.toString() ?? null,
    internalCode: asset.internalCode,
    custodian: asset.custodian,
    details: detailsOut(asset.details),
    status: asset.status,
    soldAt: asset.soldAt?.toISOString() ?? null,
    valueChangeRatePct: asset.valueChangeRatePct?.toString() ?? null,
    valueChangeMode: asset.valueChangeMode,
    valueChangeAmount: asset.valueChangeAmount?.toString() ?? null,
    categoryId: asset.categoryId,
    acquisitionDate: asset.acquisitionDate?.toISOString() ?? null,
    currentEstimatedValue: computeEstimatedValue(
      asset.currentValue,
      asset.valueChangeRatePct,
      asset.acquisitionDate ?? asset.createdAt,
      new Date(),
      asset.valueChangeMode,
      asset.valueChangeAmount,
    ).toString(),
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

function toHistoryDto(
  h: {
    id: string;
    assetId: string;
    value: bigint;
    recordedAt: Date;
    recordedByUserId?: string | null;
    note?: string | null;
  },
  previousValue: bigint | null = null,
  recordedByName: string | null = null,
): AssetHistoryResponseDto {
  let changePercent: string | null = null;
  if (previousValue !== null && previousValue !== BigInt(0)) {
    // two-decimal percent, computed in integers to keep BigInt exactness
    const scaled = ((h.value - previousValue) * BigInt(10_000)) / previousValue;
    changePercent = (Number(scaled) / 100).toFixed(2);
  }
  return {
    id: h.id,
    assetId: h.assetId,
    value: h.value.toString(),
    recordedAt: h.recordedAt.toISOString(),
    changePercent,
    recordedByName,
    note: h.note ?? null,
  };
}

/** Aset Task 18 — identity fields editable on the asset (not quantity). */
function identityFields(dto: {
  unit?: string | null;
  valuationModel?: AssetValuationModel;
  internalCode?: string | null;
  custodian?: string | null;
}): {
  unit?: string | null;
  valuationModel?: AssetValuationModel;
  internalCode?: string | null;
  custodian?: string | null;
} {
  const clean = (v: string | null | undefined) =>
    v === undefined ? undefined : v?.trim() || null;
  return {
    unit: clean(dto.unit),
    valuationModel: dto.valuationModel,
    internalCode: clean(dto.internalCode),
    custodian: clean(dto.custodian),
  };
}

const QUANTITY_RE = /^\d+(\.\d{1,8})?$/;

/**
 * A per-unit asset is valued as quantity × price: without a quantity every
 * later valuation would price to Rp0. The error names the field so the form
 * can show it next to "Jumlah".
 */
function perUnitOpeningQuantity(raw: string | null | undefined): string {
  const q = raw?.trim() ?? "";
  const fail = (message: string): never => {
    throw new BadRequestException({
      statusCode: 400,
      error: "Bad Request",
      code: "ASSET_QUANTITY_INVALID",
      field: "quantity",
      message,
    });
  };
  if (!q) {
    return fail(
      "Jumlah wajib diisi untuk aset yang dinilai per unit (mis. 10 gram).",
    );
  }
  if (!QUANTITY_RE.test(q)) {
    return fail("Jumlah harus angka, maksimal 8 angka di belakang koma.");
  }
  if (!new Prisma.Decimal(q).greaterThan(0)) {
    return fail("Jumlah harus lebih dari 0.");
  }
  return q;
}

/** internalCode is unique per family: a clash is a 409, never a 500. */
async function uniqueCode<T>(write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new ConflictException("Kode internal aset ini sudah dipakai");
    }
    throw err;
  }
}

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly valuations: AssetValuationsService,
  ) {}

  async findAll(
    familyGroupId: string,
    viewer?: AssetViewer,
  ): Promise<AssetResponseDto[]> {
    const assets = await this.prisma.asset.findMany({
      where: { familyGroupId, ...viewerAssetWhere(viewer) },
      orderBy: { createdAt: "asc" },
    });
    return assets.map(toAssetDto);
  }

  async create(
    familyGroupId: string,
    dto: CreateAssetDto,
    viewer?: AssetViewer,
  ): Promise<AssetResponseDto> {
    if (!/^\d+$/.test(dto.currentValue)) {
      throw new BadRequestException(
        "currentValue must be a non-negative integer string",
      );
    }
    this.assertValidRatePct(dto.valueChangeRatePct);
    this.assertValidValueChangeAmount(dto.valueChangeAmount);
    this.assertValidAcquisitionDate(dto.acquisitionDate);
    const openingQty =
      dto.valuationModel === "per_unit"
        ? perUnitOpeningQuantity(dto.quantity)
        : null;
    const categoryId = await this.resolveCategoryId(
      familyGroupId,
      dto.categoryId,
    );
    const details = detailsColumn(dto.type, dto.details);
    const plan = planOpening(dto);
    const ownerUserId = await resolveCreateOwner(
      this.prisma,
      familyGroupId,
      dto.ownerUserId,
      viewer,
    );

    // The asset and its opening rows commit together (see writeOpening:
    // cost basis = opening transaction, Nilai saat ini = valuation row).
    const asset = await uniqueCode(
      this.prisma.$transaction(async (tx) => {
        const created = await tx.asset.create({
          data: {
            ...identityFields(dto),
            familyGroupId,
            ownerUserId,
            name: dto.name,
            type: dto.type,
            currentValue: BigInt(dto.currentValue),
            currency: dto.currency ?? "IDR",
            notes: dto.notes ?? null,
            details,
            valueChangeRatePct: dto.valueChangeRatePct ?? null,
            valueChangeMode: dto.valueChangeMode ?? "percent",
            valueChangeAmount:
              dto.valueChangeAmount != null
                ? BigInt(dto.valueChangeAmount)
                : null,
            categoryId: categoryId ?? null,
            acquisitionDate: dto.acquisitionDate
              ? new Date(dto.acquisitionDate)
              : null,
          },
        });
        return writeOpening(
          tx,
          this.valuations,
          created,
          openingQty,
          plan,
          viewer?.userId ?? null,
        );
      }),
    );

    return toAssetDto(asset);
  }

  async update(
    familyGroupId: string,
    id: string,
    dto: UpdateAssetDto,
    viewer?: AssetViewer,
  ): Promise<AssetResponseDto> {
    const existing = await this.prisma.asset.findUnique({
      where: { id, familyGroupId, AND: [viewerAssetWhere(viewer)] },
    });
    if (!existing) {
      throw new NotFoundException("Asset not found");
    }

    if (dto.currentValue != null && !/^\d+$/.test(dto.currentValue)) {
      throw new BadRequestException(
        "currentValue must be a non-negative integer string",
      );
    }
    this.assertValidRatePct(dto.valueChangeRatePct);
    this.assertValidValueChangeAmount(dto.valueChangeAmount);
    this.assertValidAcquisitionDate(dto.acquisitionDate);
    const newValue =
      dto.currentValue != null
        ? BigInt(dto.currentValue)
        : existing.currentValue;
    const categoryId =
      dto.categoryId !== undefined
        ? await this.resolveCategoryId(familyGroupId, dto.categoryId)
        : existing.categoryId;

    const details = detailsForUpdate(existing, dto);
    const data = {
      ...identityFields(dto),
      ...(details !== undefined ? { details } : {}),
      name: dto.name ?? existing.name,
      type: dto.type ?? existing.type,
      currency: dto.currency ?? existing.currency,
      notes: dto.notes !== undefined ? (dto.notes ?? null) : existing.notes,
      valueChangeRatePct:
        dto.valueChangeRatePct !== undefined
          ? dto.valueChangeRatePct
          : existing.valueChangeRatePct,
      valueChangeMode: dto.valueChangeMode ?? existing.valueChangeMode,
      valueChangeAmount:
        dto.valueChangeAmount !== undefined
          ? dto.valueChangeAmount != null
            ? BigInt(dto.valueChangeAmount)
            : null
          : existing.valueChangeAmount,
      categoryId: categoryId ?? null,
      acquisitionDate:
        dto.acquisitionDate !== undefined
          ? dto.acquisitionDate
            ? new Date(dto.acquisitionDate)
            : null
          : existing.acquisitionDate,
    };

    if (dto.currentValue == null || newValue === existing.currentValue) {
      const updated = await uniqueCode(
        this.prisma.asset.update({ where: { id, familyGroupId }, data }),
      );
      return toAssetDto(updated);
    }

    // A new value is a valuation: same path as Update Nilai (lock, linked /
    // archived guards, effective order, rebuild, audit). Never cash or cost.
    const updated = await uniqueCode(
      runSerializableWithRetry(this.prisma, async (tx) => {
        const asset = await lockAsset(tx, familyGroupId, id, viewer, "write");
        const withInfo = await tx.asset.update({
          where: { id, familyGroupId },
          data,
        });
        const effective = nowEffectiveFields();
        const row = await this.valuations.insert(
          tx,
          withInfo,
          {
            ...effective,
            effectiveYmd: dbDateToYmd(effective.effectiveDate),
            timeZone: null,
            pricePerUnit: null,
            amount: new Prisma.Decimal(newValue.toString()),
            currency: "IDR",
            fxRate: null,
            source: "manual",
            reference: null,
            note: null,
          },
          viewer?.userId ?? null,
          null,
        );
        if (viewer?.userId) {
          await tx.auditLog.create({
            data: {
              userId: viewer.userId,
              familyGroupId,
              entity: "asset_valuation",
              entityId: row.id,
              action: "create",
              before: { currentValue: asset.currentValue.toString() },
              after: { value: newValue.toString(), via: "PATCH /assets" },
            },
          });
        }
        return tx.asset.findUniqueOrThrow({ where: { id } });
      }),
    );
    return toAssetDto(updated);
  }

  /** -100..100 inclusive; class-validator only checks the string format. */
  private assertValidRatePct(value?: string): void {
    if (value == null) return;
    const n = Number(value);
    if (!Number.isFinite(n) || n < MIN_RATE_PCT || n > MAX_RATE_PCT) {
      throw new BadRequestException(
        `valueChangeRatePct must be between ${MIN_RATE_PCT} and ${MAX_RATE_PCT}`,
      );
    }
  }

  /**
   * EPIC-024 D2/US-ASSET-6: signed BigInt string, e.g. "-5000000". The DTO's
   * @Matches already rejects non-numeric strings; this only needs to guard
   * against BigInt() throwing on the shape a regex can't easily express
   * (leading zeros, `+` sign, etc. are already blocked by the DTO regex).
   */
  private assertValidValueChangeAmount(value?: string): void {
    if (value == null) return;
    try {
      BigInt(value);
    } catch {
      throw new BadRequestException(
        "valueChangeAmount must be a signed integer string, e.g. '-5000000'",
      );
    }
  }

  /**
   * EPIC-023 D19/US-ASSET-4: rejects an obviously-invalid or future
   * acquisition date instead of silently coercing it — same posture as
   * assertValidRatePct/currentValue above. class-validator's @IsDateString
   * on the DTO already blocks non-ISO strings before this runs; this catches
   * dates class-validator accepts as well-formed but that are not valid
   * business inputs (e.g. tomorrow).
   *
   * EPIC-023 Task H1 review (HIGH fix 1): "future" is judged against WIB
   * "today", not the raw `Date.now()` instant — see wibTodayUtcMidnight
   * above for why.
   */
  private assertValidAcquisitionDate(value?: string): void {
    if (value == null) return;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("acquisitionDate must be a valid date");
    }
    if (parsed.getTime() > wibTodayUtcMidnight(new Date()).getTime()) {
      throw new BadRequestException("acquisitionDate cannot be in the future");
    }
  }

  /** Validates categoryId belongs to this family group (tenant scope). */
  private async resolveCategoryId(
    familyGroupId: string,
    categoryId?: string,
  ): Promise<string | null> {
    if (!categoryId) return null;
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, familyGroupId },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException(
        "categoryId does not belong to this family group",
      );
    }
    return category.id;
  }

  /**
   * A5 — delete becomes archive. A hard delete only removes an asset with
   * nothing the user recorded: no transactions, no documents, and at most the
   * system opening row create() wrote. Anything else is archived (kept,
   * excluded from totals, audited) so its history survives.
   */
  async remove(
    familyGroupId: string,
    id: string,
    viewer?: AssetViewer,
  ): Promise<void> {
    const existing = await this.prisma.asset.findUnique({
      where: { id, familyGroupId, AND: [viewerAssetWhere(viewer)] },
    });
    if (!existing) {
      throw new NotFoundException("Asset not found");
    }
    const [txCount, attachments, history] = await Promise.all([
      this.prisma.assetTransaction.count({ where: { assetId: id } }),
      this.prisma.assetAttachment.count({ where: { assetId: id } }),
      this.prisma.assetHistory.findMany({
        where: { assetId: id },
        select: { kind: true, recordedByUserId: true, note: true },
      }),
    ]);
    const onlySystemOpening =
      history.length === 0 ||
      (history.length === 1 &&
        history[0]!.kind === "opening" &&
        !history[0]!.recordedByUserId &&
        !history[0]!.note);
    if (txCount > 0 || attachments > 0 || !onlySystemOpening) {
      if (existing.status === "archived") return;
      await this.prisma.$transaction(async (tx) => {
        await tx.asset.update({
          where: { id, familyGroupId },
          data: { status: "archived" },
        });
        if (viewer?.userId) {
          await tx.auditLog.create({
            data: {
              userId: viewer.userId,
              familyGroupId,
              entity: "Asset",
              entityId: id,
              action: "archive",
              before: { status: existing.status },
              after: { status: "archived" },
            },
          });
        }
      });
      return;
    }
    try {
      await this.prisma.asset.delete({ where: { id, familyGroupId } });
    } catch (err) {
      // asset_transactions.assetId is NO ACTION: an asset with ledger rows
      // can never be hard-deleted (a concurrent write). Never a 500.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2003"
      ) {
        throw new ConflictException(
          "Aset ini memiliki riwayat transaksi dan tidak dapat dihapus. Arsipkan aset ini.",
        );
      }
      throw err;
    }
  }

  /**
   * Legacy value list (oldest first) in the A4 effective order — never by
   * recordedAt — active rows only; change vs the previous row.
   */
  async findHistory(
    familyGroupId: string,
    id: string,
    viewer?: AssetViewer,
  ): Promise<AssetHistoryResponseDto[]> {
    const asset = await this.prisma.asset.findUnique({
      where: { id, familyGroupId, AND: [viewerAssetWhere(viewer)] },
    });
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }

    const history = await this.prisma.assetHistory.findMany({
      where: { assetId: id, status: "active" },
      orderBy: [
        { effectiveDate: "asc" },
        { hasTime: "asc" },
        { effectiveAt: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });
    const nameById = await userNames(
      this.prisma,
      history.map((h) => h.recordedByUserId),
    );
    return history.map((h, i) =>
      toHistoryDto(
        { ...h, recordedAt: h.effectiveAt },
        i > 0 ? (history[i - 1]?.value ?? null) : null,
        h.recordedByUserId ? (nameById.get(h.recordedByUserId) ?? null) : null,
      ),
    );
  }

  /**
   * EPIC-033 group 3 (p17) — a member-entered valuation (legacy body: total
   * value or % on the current value). Written through the Task 18
   * valuation path: effective order (a backdated entry never overrides a
   * newer one), recomputed asset, never touches cash or cost. A UTC-midnight
   * `recordedAt` is a date-only entry.
   */
  async recordValue(
    familyGroupId: string,
    id: string,
    dto: RecordAssetValueDto,
    actingUserId: string | null,
    viewer?: AssetViewer,
  ): Promise<AssetHistoryResponseDto> {
    if ((dto.value == null) === (dto.changePercent == null)) {
      throw new BadRequestException(
        "Provide exactly one of value or changePercent",
      );
    }
    const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : new Date();
    if (recordedAt.getTime() > Date.now() + 60_000) {
      throw new BadRequestException("recordedAt cannot be in the future");
    }
    const effective = dto.recordedAt
      ? historyEffectiveFields(recordedAt)
      : nowEffectiveFields(recordedAt);
    const { row, previous } = await runSerializableWithRetry(
      this.prisma,
      async (tx) => {
        const asset = await lockAsset(tx, familyGroupId, id, viewer, "write");
        let value: bigint;
        if (dto.value != null) {
          value = BigInt(dto.value);
        } else {
          // percent with 2 decimals → scale by 10_000 to stay in integers
          const pctScaled = BigInt(
            Math.round(Number.parseFloat(dto.changePercent!) * 100),
          );
          value =
            asset.currentValue +
            (asset.currentValue * pctScaled) / BigInt(10_000);
          if (value < BigInt(0)) {
            throw new BadRequestException("Resulting value cannot be negative");
          }
        }
        const written = await this.valuations.insert(
          tx,
          asset,
          {
            ...effective,
            effectiveYmd: dbDateToYmd(effective.effectiveDate),
            timeZone: null,
            pricePerUnit: null,
            amount: new Prisma.Decimal(value.toString()),
            currency: "IDR",
            fxRate: null,
            source: "manual",
            reference: null,
            note: dto.note ?? null,
          },
          actingUserId,
          null,
        );
        const t = timelineOf(asset, await loadState(tx, asset.id));
        const idx = t.ordered.findIndex((r) => r.id === written.id);
        const prevRow = idx > 0 ? t.ordered[idx - 1] : undefined;
        return {
          row: written,
          previous: prevRow ? (t.states.get(prevRow.id)?.value ?? null) : null,
        };
      },
    );
    const names = await userNames(this.prisma, [actingUserId]);
    return toHistoryDto(
      { ...row, recordedAt: row.effectiveAt },
      previous,
      actingUserId ? (names.get(actingUserId) ?? null) : null,
    );
  }
}
