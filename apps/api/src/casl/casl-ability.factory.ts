import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from "@casl/ability";
import { Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";

import {
  canReadResource,
  canWriteResource,
  type ResourceKey,
} from "../access/resource-access";

import type { EffectiveAccess } from "@wealthme/contracts";

export type Action = "manage" | "create" | "read" | "update" | "delete";
export type Subject =
  | "Account"
  | "AiKey"
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
  | "Reconciliation"
  | "ReconciliationTemplate"
  | "ReferenceItem"
  | "Report"
  | "SplitBill"
  | "TaxRecord"
  | "Transaction"
  | "all";

export type AppAbility = MongoAbility<[Action, Subject]>;

/** EPIC-030 — CASL subject → IAM resource (see access/resource-access.ts). */
const SUBJECT_RESOURCE: ReadonlyArray<[Subject, ResourceKey]> = [
  ["Account", "accounts"],
  ["Transaction", "transactions"],
  ["Category", "categories"],
  ["ReferenceItem", "reference-items"],
  ["CoaAccount", "coa-accounts"],
  ["Budget", "budgets"],
  ["Goal", "goals"],
  ["Liability", "liabilities"],
  ["Insurance", "insurances"],
  ["Investment", "investments"],
  ["Asset", "assets"],
  ["Inheritance", "inheritance"],
  ["Donation", "donations"],
  ["TaxRecord", "tax"],
  ["SplitBill", "split-bills"],
  ["Reconciliation", "reconciliation"],
  ["ReconciliationTemplate", "reconciliation"],
  ["AiKey", "ai-key"],
  ["AllowanceRequest", "allowance-requests.decide"],
];

@Injectable()
export class CaslAbilityFactory {
  /**
   * EPIC-030 — once the Master customises a member (custom role or any
   * override), their grants come from the IAM page map instead of the fixed
   * per-role switch below; otherwise the switch applies unchanged.
   */
  createForMember(
    member: { role: Role },
    access?: EffectiveAccess | null,
  ): AppAbility {
    if (
      access &&
      !access.isMaster &&
      (access.source === "custom-role" || access.hasOverrides)
    ) {
      return this.createFromAccess(access);
    }
    return this.createForRole(member);
  }

  private createFromAccess(access: EffectiveAccess): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    for (const [subject, resource] of SUBJECT_RESOURCE) {
      if (canWriteResource(access, resource)) can("manage", subject);
      else if (canReadResource(access, resource)) can("read", subject);
    }
    // Baseline every family member has regardless of pages: read the family
    // and its members, ask for money / see their own requests, and read +
    // mark their own notifications (services row-scope these).
    can("read", "FamilyGroup");
    can("read", "Member");
    can("read", "MemberCategoryAllowance");
    can("create", "AllowanceRequest");
    can("read", "AllowanceRequest");
    can("read", "Notification");
    can("update", "Notification");
    return build();
  }

  private createForRole(member: { role: Role }): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    switch (member.role) {
      case Role.owner:
        can("manage", "Account");
        // EPIC-023 G3/G2 (D16/D17) — the AI provider key and saved
        // reconciliation column-mapping templates are owner-level settings
        // (credentials / saved configuration, not day-to-day ledger work).
        can("manage", "AiKey");
        can("manage", "ReconciliationTemplate");
        can("manage", "AllowanceRequest");
        can("manage", "Asset");
        can("manage", "Budget");
        can("manage", "Category");
        can("manage", "CoaAccount");
        can("manage", "Donation");
        // EPIC-023 F2 (D20) — the family religion setting (zakat vs.
        // perpuluhan vs. neither) is owner-writable, matching the gold-price
        // precedent (owner-only write, every member can read — below).
        can("manage", "FamilyGroup");
        can("manage", "Goal");
        can("manage", "Inheritance");
        can("manage", "Insurance");
        can("manage", "Investment");
        can("manage", "Liability");
        can("manage", "Member");
        can("manage", "MemberCategoryAllowance");
        can("manage", "Notification");
        // EPIC-021 Group C (#29) — reconciliation fee-splitting creates real
        // ledger Transactions; gate it as a bookkeeping action (owner +
        // admin_staff), not the general "manage Transaction" grant every
        // role effectively already has.
        can("manage", "Reconciliation");
        // EPIC-024 Task J (D14, US-MD-1) — the seven reference lists (bank,
        // e-wallet, transaction type, investment type, donation institution,
        // asset category, insurance type) are owner/co-master-managed master
        // data, same shape as Category above.
        can("manage", "ReferenceItem");
        // EPIC-023 Task C retry (six-reviewer finding) — SplitBill had no
        // grant on any role; owner gets the same full "manage" every other
        // money surface gets.
        can("manage", "SplitBill");
        can("manage", "TaxRecord");
        can("manage", "Transaction");
        break;

      case Role.member:
        can("read", "Account");
        // EPIC-023 G3/G2 (D16/D17) — a member may see whether the AI
        // advisor is configured (to know whether the chat surface is
        // usable) and see saved bank templates (to know which banks are
        // already mapped when uploading) — never manage/set/delete either.
        can("read", "AiKey");
        can("read", "ReconciliationTemplate");
        // EPIC-019 Task B — a member may file/read their own allowance
        // requests; only an owner may approve/reject (see "manage" above).
        can("create", "AllowanceRequest");
        can("read", "AllowanceRequest");
        can("manage", "Asset");
        can("manage", "Budget");
        can("read", "Category");
        can("read", "CoaAccount");
        can("manage", "Donation");
        // EPIC-023 F2 (D20) — every member may read the family religion
        // setting (the donation page needs it to pick zakat/perpuluhan/
        // neither); only the owner may change it (see "manage" above).
        can("read", "FamilyGroup");
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
        // EPIC-023 Task C retry (HIGH six-reviewer finding) — restores the
        // day-to-day reconciliation workflow (upload/list/match/auto-match)
        // to `member`: EPIC-021 Group C (#29) only ever reserved the
        // fee-SPLIT action (creates real ledger Transactions, gated
        // "manage" below/on owner+admin_staff+spouse) for the bookkeeping
        // roles — its own commit message states the pre-existing
        // upload/match/auto-match endpoints were left untouched. Round 2
        // wrongly flattened the whole controller onto "manage" and 403'd
        // `member` on everything; gate by the action each route performs
        // instead (reconciliation.controller.ts).
        can("read", "Reconciliation");
        can("create", "Reconciliation");
        // EPIC-024 Task J (D14) — a member can read the reference lists (to
        // use them in pickers) but not add/remove entries; that stays
        // owner/spouse-managed master data.
        can("read", "ReferenceItem");
        // EPIC-023 Task C retry — a plain member may fully manage a split
        // bill (create/settle/delete one they set up), same as every other
        // household-coordination surface (Budget/Goal/Donation/...) below.
        can("manage", "SplitBill");
        can("manage", "TaxRecord");
        can("manage", "Transaction");
        break;

      case Role.admin_staff:
        can("read", "Account");
        // EPIC-023 G3/G2 (D16/D17) — bookkeeper can see AI-advisor
        // configuration status but not manage the key (that stays
        // owner/spouse-level, matching "managing AI keys ... are
        // owner-level actions"); bookkeeper CAN manage saved reconciliation
        // templates, consistent with already holding "manage Reconciliation"
        // below.
        can("read", "AiKey");
        can("manage", "ReconciliationTemplate");
        can("create", "AllowanceRequest");
        can("read", "AllowanceRequest");
        can("read", "Asset");
        can("read", "Budget");
        can("read", "Category");
        can("read", "CoaAccount");
        can("read", "Donation");
        can("read", "FamilyGroup");
        can("read", "Goal");
        can("read", "Inheritance");
        can("read", "Insurance");
        can("read", "Investment");
        can("read", "Liability");
        can("read", "Member");
        can("read", "MemberCategoryAllowance");
        can("read", "Notification");
        // Marking a notification read writes a receipt for the bookkeeper
        // themself only (NotificationsService.markRead) — without this the
        // "Tandai dibaca" buttons 403'd for this role.
        can("update", "Notification");
        // EPIC-021 Group C (#29) — bookkeeper role can perform the
        // reconciliation fee-split (see the owner-case comment above).
        can("manage", "Reconciliation");
        // EPIC-024 Task J (D14) — same read-only grant as Category above.
        can("read", "ReferenceItem");
        // EPIC-023 Task C retry — bookkeeper can see split bills (needed to
        // reconcile them against the ledger) but never create/settle/delete
        // one; that stays a household-coordination action for owner/spouse/
        // member.
        can("read", "SplitBill");
        can("read", "TaxRecord");
        can("create", "Transaction");
        can("read", "Transaction");
        // Recording a transaction needs the category picker; read-only.
        can("read", "Category");
        break;

      // EPIC-023 Task C (D2) — a financial co-owner: full CRUD on every
      // money surface `owner` has, EXCEPT Member (read-only, never
      // "manage" — one accountable head stays responsible for who is in
      // the family) and no family-group deletion capability (no role is
      // granted that today; see the "FamilyGroup" subject, unused above).
      case Role.spouse:
        can("manage", "Account");
        // EPIC-023 G3/G2 (D2/D16/D17) — full financial co-owner: same
        // owner-level reach over the AI key and reconciliation templates.
        can("manage", "AiKey");
        can("manage", "ReconciliationTemplate");
        can("manage", "AllowanceRequest");
        can("manage", "Asset");
        can("manage", "Budget");
        can("manage", "Category");
        can("manage", "CoaAccount");
        can("manage", "Donation");
        // EPIC-023 F2 (D20) — read-only, same as Member above: a spouse is
        // a full financial co-owner but the family religion setting stays
        // owner-writable (D2's "one accountable head" pattern, mirrored
        // here the same way it already is for the Member subject).
        can("read", "FamilyGroup");
        can("manage", "Goal");
        can("manage", "Inheritance");
        can("manage", "Insurance");
        can("manage", "Investment");
        can("manage", "Liability");
        can("read", "Member");
        can("manage", "MemberCategoryAllowance");
        can("manage", "Notification");
        can("manage", "Reconciliation");
        // EPIC-024 Task J (D14) — full financial co-owner, same "manage" as
        // owner above.
        can("manage", "ReferenceItem");
        // EPIC-023 Task C retry — a spouse is a full financial co-owner
        // (D2), same "manage" every other money surface above gets.
        can("manage", "SplitBill");
        can("manage", "TaxRecord");
        can("manage", "Transaction");
        break;

      // EPIC-023 Task C (D3) — a child: scoped to their own account and
      // their own transactions (row-level scoping is enforced in every
      // service read path, see common/utils/privacy.util.ts — the subject
      // grants below are necessary but not sufficient). Full "read" on
      // Inheritance is an explicit accepted consequence (D4/C3), not an
      // oversight. No Member, CoaAccount, Reconciliation, TaxRecord, AiKey,
      // or ReconciliationTemplate access; "create"+"read" only on
      // Transaction — never "manage", matching admin_staff's shape (no
      // update/delete of ledger history).
      case Role.dependant:
        can("read", "Account");
        can("create", "AllowanceRequest");
        can("read", "AllowanceRequest");
        // EPIC-023 F2 (D20) — harmless descriptive setting (no money, no
        // PII); read-only for every role, same grant every other role gets.
        can("read", "FamilyGroup");
        can("read", "Inheritance");
        // Notifications addressed to THEM specifically — a request they filed
        // being approved or rejected. Read + update (to mark their own read),
        // never `manage`. The subject-level grant is not the whole control:
        // NotificationsService restricts these roles to rows carrying their
        // own userId, so the household-wide rows (net worth, KPR, budgets,
        // other members' requests) stay out of reach exactly as
        // `assertHouseholdWideReadAllowed` keeps them out of reports.
        can("read", "Notification");
        can("update", "Notification");
        can("create", "Transaction");
        can("read", "Transaction");
        // Recording a transaction needs the category picker; read-only.
        can("read", "Category");
        break;

      // EPIC-023 Task C (D5) — a helper/driver: their own account AND its
      // balance (otherwise the role cannot function), plus their own
      // transactions. Nothing else — no Inheritance, no Member, no COA, no
      // Reconciliation, no TaxRecord, no AiKey, no ReconciliationTemplate.
      case Role.operational:
        can("read", "Account");
        can("create", "AllowanceRequest");
        can("read", "AllowanceRequest");
        // EPIC-023 F2 (D20) — same read-only grant every other role gets.
        can("read", "FamilyGroup");
        // Notifications addressed to THEM specifically — a request they filed
        // being approved or rejected. Read + update (to mark their own read),
        // never `manage`. The subject-level grant is not the whole control:
        // NotificationsService restricts these roles to rows carrying their
        // own userId, so the household-wide rows (net worth, KPR, budgets,
        // other members' requests) stay out of reach exactly as
        // `assertHouseholdWideReadAllowed` keeps them out of reports.
        can("read", "Notification");
        can("update", "Notification");
        can("create", "Transaction");
        can("read", "Transaction");
        // Recording a transaction needs the category picker; read-only.
        can("read", "Category");
        break;

      default: {
        // EPIC-023 Task C retry (six-reviewer finding) — exhaustiveness
        // guard: if `Role` ever gains a seventh member without a `case`
        // above, this assignment fails to compile (the new enum literal is
        // not assignable to `never`) instead of silently falling through to
        // a zero-grant ability at runtime.
        const _exhaustiveCheck: never = member.role;
        void _exhaustiveCheck;
        break;
      }
    }

    return build();
  }
}
