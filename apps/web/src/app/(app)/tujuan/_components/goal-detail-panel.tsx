"use client";

import { useState } from "react";
import { PiggyBank, Pencil, Trash2, Wallet, X } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
  PanelContent,
} from "@/components/ui/dialog";
import { GoalIcon, Track } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";

import { ContributionHistory } from "./contribution-history";

import type { GoalDto } from "@wealthme/contracts";

// EPIC-033 revision — the tile face only ever showed icon/name/%/bar/one
// meta line (see GoalTile in ../page.tsx); the "Perlu menabung" advice,
// Setor/Edit/Hapus actions, and Riwayat Setoran now live here, in the
// side panel the tile opens on click. No functionality is removed — every
// handler/testid/aria below is the same one `page.tsx` already wired, just
// triggered from inside this panel instead of from the tile face.
interface GoalDetailPanelProps {
  goal: GoalDto;
  tone: "lime" | "orange" | "bad";
  metaLine: string;
  dateLine: string | null;
  monthlyNeeded: number | null;
  monthsUntilTarget: number | null;
  canManage: boolean;
  familyGroupId: string;
  token: string | undefined;
  onClose: () => void;
  onEdit: (goal: GoalDto) => void;
  onDelete: (goal: GoalDto) => void;
  onContribute: (goal: GoalDto) => void;
}

export function GoalDetailPanel({
  goal,
  tone,
  metaLine,
  dateLine,
  monthlyNeeded,
  monthsUntilTarget,
  canManage,
  familyGroupId,
  token,
  onClose,
  onEdit,
  onDelete,
  onContribute,
}: GoalDetailPanelProps) {
  const { t } = useLocale();
  const money = useMoney();
  const [showHistory, setShowHistory] = useState(false);
  const hasAutoDebit = goal.autoDebitAmount != null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <PanelContent variant="side" className="wm-form-panel tj-detail-panel">
        <header className="wm-panel-head">
          <div className="min-w-0">
            <DialogTitle className="wm-panel-title">{goal.name}</DialogTitle>
            <DialogDescription className="wm-panel-desc">
              {t.tujuan.statusLabels[goal.status]}
            </DialogDescription>
          </div>
          <DialogClose className="wm-panel-x" aria-label={t.common.close}>
            <X aria-hidden="true" />
          </DialogClose>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="wm-panel-body tj-detail-body">
            <div className="tj-detail-progress">
              <span className="wm-ci tj-icon">
                <GoalIcon icon={goal.icon} name={goal.name} size={20} />
              </span>
              <div className="tj-detail-progress-main">
                <span className="wm-pv tj-pv" data-tone={tone}>
                  {goal.progressPercent}%
                </span>
                <Track value={goal.progressPercent} fill={tone} />
                <small className="tj-meta-line">
                  {metaLine}
                  {dateLine ? ` · ${dateLine}` : ""}
                </small>
              </div>
            </div>

            {monthlyNeeded != null && (
              <span
                className="tj-notice"
                data-tone={hasAutoDebit ? tone : "bad"}
              >
                <PiggyBank aria-hidden="true" />
                <span>
                  {t.tujuan.noticeSavingsPrefix}
                  <strong>{money.format(monthlyNeeded)}</strong>
                  {hasAutoDebit && monthsUntilTarget != null
                    ? `${t.tujuan.noticeSavingsPerMonthMiddle}${monthsUntilTarget}${t.tujuan.noticeSavingsMonthsSuffix}`
                    : t.tujuan.noticeSavingsNoAutoDebitSuffix}
                </span>
              </span>
            )}

            {canManage && (
              <span className="tj-acts">
                {/* A reached goal has nothing left to fund: Setor is not
                    its primary action. Edit becomes the lead instead. */}
                {goal.remainingAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => onContribute(goal)}
                    aria-label={`${t.tujuan.contributeButtonAriaPrefix}${goal.name}`}
                    data-primary="true"
                  >
                    <Wallet aria-hidden="true" /> {t.tujuan.contributeButton}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onEdit(goal)}
                  data-primary={goal.remainingAmount > 0 ? undefined : "true"}
                >
                  <Pencil aria-hidden="true" /> {t.tujuan.editButton}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(goal)}
                  data-danger="true"
                >
                  <Trash2 aria-hidden="true" /> {t.tujuan.deleteButton}
                </button>
              </span>
            )}

            <button
              type="button"
              className="tj-history-toggle"
              onClick={() => setShowHistory((open) => !open)}
              aria-expanded={showHistory}
            >
              {showHistory
                ? t.tujuan.historyToggleHide
                : t.tujuan.historyToggleShow}
            </button>
            {showHistory && (
              <div className="tj-history">
                <ContributionHistory
                  goalId={goal.id}
                  familyGroupId={familyGroupId}
                  token={token}
                />
              </div>
            )}
          </div>
        </div>
      </PanelContent>
    </Dialog>
  );
}
