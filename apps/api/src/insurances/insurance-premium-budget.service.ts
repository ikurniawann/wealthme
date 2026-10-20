import { BadRequestException, Injectable, Logger } from "@nestjs/common";

import { effectiveBudgetType } from "../common/utils/effective-budget-type.util";
import { ownCategoryName } from "../common/utils/own-category-name.util";

import type { TxClient } from "../common/utils/serializable-retry.util";

// EPIC-023 group E retry (HIGH 3) — a DEDICATED insurance-premium expense
// account. GENERIC_COA_CHART (every real family) now provisions "20010"
// (Premi Asuransi) via the group-E-retry migration, mirroring loans' "20009"
// (Bunga Pinjaman, A1/A2) exactly. "20099" (Pengeluaran Lainnya) — the
// generic catch-all `defaultCoaCodeForCategory` falls back to for ANY
// unmatched expense category — is GONE from this list: reusing it used to
// silently hijack whatever user-made category/budget already lived on that
// shared bucket (increment its limit, flip it FIXED, and block its
// deletion). The demo seed's richer chart provides "21104" (Asset & Other
// Insurance), which was already a genuinely dedicated code, unchanged.
//
// HIGH 11 (group E retry round 3) — ORDER IS THE PREFERENCE, not
// lexical/alphabetical. `resolveOwnPremiumCategoryId` below tries "21104"
// FIRST: a family whose chart already provisions the richer, purpose-built
// "21104" must keep using it for every new policy, never get silently
// switched to the generic "20010" the migration also inserts for everyone
// just because "20010" < "21104" as a string. A family with only "20010"
// (the common case — every real GENERIC_COA_CHART family) falls through to
// it.
const INSURANCE_PREMIUM_COA_PRIORITY = ["21104", "20010"];

type BudgetPolicy = {
  id: string;
  name: string;
  premiumCategoryId?: string | null;
};

/**
 * EPIC-023 E2/H4/H6 — a policy's OWN premium category and FIXED budget line,
 * extracted unchanged from InsurancesService (Task 22) so create/update and
 * pay share it. Every method runs on the caller's transaction client.
 */
@Injectable()
export class InsurancePremiumBudgetService {
  private readonly logger = new Logger(InsurancePremiumBudgetService.name);

  /**
   * Creates, re-derives, or removes this policy's OWN FIXED budget line so
   * `limitAmount` always equals ITS current monthly-normalised premium —
   * mirrors `LiabilitiesService.syncPrincipalBudgetLine`.
   */
  async syncPremiumBudgetLine(
    tx: TxClient,
    familyGroupId: string,
    insurance: BudgetPolicy,
    contribution: bigint,
  ): Promise<void> {
    if (contribution <= BigInt(0)) {
      await tx.budget.deleteMany({
        where: { familyGroupId, insuranceId: insurance.id },
      });
      return;
    }

    const categoryId = await this.resolveOwnPremiumCategoryId(
      tx,
      familyGroupId,
      insurance,
    );
    await tx.budget.upsert({
      where: {
        familyGroupId_categoryId_period: {
          familyGroupId,
          categoryId,
          period: "monthly",
        },
      },
      create: {
        familyGroupId,
        categoryId,
        period: "monthly",
        limitAmount: contribution,
        insuranceId: insurance.id,
        budgetType: "FIXED",
      },
      update: {
        limitAmount: contribution,
        insuranceId: insurance.id,
        budgetType: "FIXED",
      },
    });
  }

  /**
   * Finds this policy's OWN premium Category — self-healing (creating it,
   * `INSURANCE_PREMIUM_COA_PRIORITY`) the first time it is needed — HIGH 4
   * redesign, mirrors `LiabilitiesService.resolveOwnPrincipalCategoryId`.
   * The category name bakes in the policy's own id (`ownCategoryName`,
   * shared with `LiabilitiesService`), eliminating the
   * `@@unique([familyGroupId, name, kind])` collision class between two
   * DIFFERENT policies by construction.
   *
   * HIGH 11 (group E retry round 3) — looks up each code in
   * `INSURANCE_PREMIUM_COA_PRIORITY` IN ORDER (one `findFirst` per code,
   * first hit wins) instead of a single `findFirst({ code: { in: [...] } },
   * orderBy: { code: "asc" } })`, which picked whichever code sorted first
   * ALPHABETICALLY ("20010" < "21104") regardless of which one was actually
   * the better fit for this family's chart.
   */
  async resolveOwnPremiumCategoryId(
    tx: TxClient,
    familyGroupId: string,
    insurance: { id: string; name: string; premiumCategoryId?: string | null },
  ): Promise<string> {
    if (insurance.premiumCategoryId) return insurance.premiumCategoryId;

    // H6 (group E retry round 4) — this policy is about to be split OUT of
    // whatever category its past premium payments were posted against
    // (the pre-HIGH-4 shared "resolvePremiumCategoryId" design every real
    // family's older policies still carry) into its own, brand-new
    // category — the IDENTICAL double-count risk
    // `LiabilitiesService.resolveOwnPrincipalCategoryId` warns about, which
    // this method never mirrored until now. See
    // `warnIfPriorSharedBudgetLine`'s own doc comment (and C3's fix on the
    // liability side) for the full reasoning.
    await this.warnIfPriorSharedBudgetLine(tx, familyGroupId, insurance);

    let coaAccount: { id: string; name: string } | null = null;
    for (const code of INSURANCE_PREMIUM_COA_PRIORITY) {
      coaAccount = await tx.coaAccount.findFirst({
        where: { familyGroupId, code },
        select: { id: true, name: true },
      });
      if (coaAccount) break;
    }
    if (!coaAccount) {
      throw new BadRequestException(
        "This family group has no insurance-premium expense COA account provisioned",
      );
    }

    const category = await tx.category.create({
      data: {
        familyGroupId,
        name: ownCategoryName(coaAccount.name, insurance.name, insurance.id),
        kind: "expense",
        coaAccountId: coaAccount.id,
      },
    });

    await tx.insurance.update({
      where: { id: insurance.id, familyGroupId },
      data: { premiumCategoryId: category.id },
    });

    return category.id;
  }

  /**
   * H6 (group E retry round 4) — mirrors
   * `LiabilitiesService.warnIfPriorSharedBudgetLine` (fixed by C3)
   * EXACTLY, adapted to insurance's own shape: premium payments post as
   * `type: "expense"` (not `"transfer"` — a liability's principal leg is
   * the only obligation type that is a TRANSFER), and `pay()`'s
   * description has always been `Premi ${insurance.name}` — stable across
   * the pre-HIGH-4 shared "resolvePremiumCategoryId" design and today's
   * per-policy one, so it finds the prior category without depending on
   * `insuranceId` (E1's column, never backfilled onto pre-existing rows)
   * or `Budget.budgetType` (MEDIUM 12's column, also never backfilled).
   * `effectiveBudgetType` (shared with `BudgetsService.toDto` and the
   * liability side) resolves FIXED the same way `/anggaran` does.
   */
  private async warnIfPriorSharedBudgetLine(
    tx: TxClient,
    familyGroupId: string,
    insurance: { id: string; name: string },
  ): Promise<void> {
    const priorPayment = await tx.transaction.findFirst({
      where: {
        familyGroupId,
        type: "expense",
        OR: [
          { insuranceId: insurance.id },
          { description: `Premi ${insurance.name}` },
        ],
      },
      select: { categoryId: true },
      orderBy: { occurredAt: "desc" },
    });
    if (!priorPayment?.categoryId) return;

    const priorSharedBudget = await tx.budget.findFirst({
      where: { familyGroupId, categoryId: priorPayment.categoryId },
      select: {
        id: true,
        limitAmount: true,
        budgetType: true,
        category: { select: { coaAccount: { select: { budgetType: true } } } },
      },
    });
    if (!priorSharedBudget) return;
    if (effectiveBudgetType(priorSharedBudget) !== "FIXED") return;

    this.logger.warn(
      `H6: insurance "${insurance.name}" (${insurance.id}) is being split into its own premium category, but its prior category still carries a FIXED budget line (budget ${priorSharedBudget.id}, limit ${priorSharedBudget.limitAmount.toString()}) that may still include this policy's contribution — the family's total budgeted limit may now be double-counted. This cannot be safely auto-corrected from the data available; review this family's budgets manually.`,
    );

    await tx.notification.create({
      data: {
        familyGroupId,
        title: "Perhatian: kemungkinan anggaran premi ganda",
        body: `"${insurance.name}" baru saja mendapat kategori anggaran sendiri, tapi anggaran lama (id ${priorSharedBudget.id}) masih memiliki batas tetap yang mungkin masih menghitung kontribusi premi ini. Silakan tinjau anggaran keluarga Anda.`,
        icon: "⚠️",
      },
    });
  }
}
