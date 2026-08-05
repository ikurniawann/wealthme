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
        can("read", "Goal");
        can("read", "Inheritance");
        can("read", "Insurance");
        can("read", "Investment");
        can("read", "Liability");
        can("read", "Member");
        can("read", "MemberCategoryAllowance");
        can("read", "Notification");
        // EPIC-021 Group C (#29) — bookkeeper role can perform the
        // reconciliation fee-split (see the owner-case comment above).
        can("manage", "Reconciliation");
        // EPIC-023 Task C retry — bookkeeper can see split bills (needed to
        // reconcile them against the ledger) but never create/settle/delete
        // one; that stays a household-coordination action for owner/spouse/
        // member.
        can("read", "SplitBill");
        can("read", "TaxRecord");
        can("create", "Transaction");
        can("read", "Transaction");
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
        can("manage", "Goal");
        can("manage", "Inheritance");
        can("manage", "Insurance");
        can("manage", "Investment");
        can("manage", "Liability");
        can("read", "Member");
        can("manage", "MemberCategoryAllowance");
        can("manage", "Notification");
        can("manage", "Reconciliation");
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
        can("read", "Inheritance");
        can("create", "Transaction");
        can("read", "Transaction");
        break;

      // EPIC-023 Task C (D5) — a helper/driver: their own account AND its
      // balance (otherwise the role cannot function), plus their own
      // transactions. Nothing else — no Inheritance, no Member, no COA, no
      // Reconciliation, no TaxRecord, no AiKey, no ReconciliationTemplate.
      case Role.operational:
        can("read", "Account");
        can("create", "AllowanceRequest");
        can("read", "AllowanceRequest");
        can("create", "Transaction");
        can("read", "Transaction");
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
