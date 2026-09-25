"use client";

import type { ReferenceItemGroup } from "@wealthme/contracts";

import { useLocale } from "@/hooks/use-locale";
import { useCanManage } from "@/hooks/use-role-permissions";

export function AddToMasterDataLink({ group }: { group: ReferenceItemGroup }) {
  const { t } = useLocale();
  const { canManage } = useCanManage("ReferenceItem");
  if (!canManage) return null;
  return (
    <a
      href={`/masterdata#${group}`}
      target="_blank"
      rel="noopener noreferrer"
      className="hint block font-semibold text-primary hover:underline"
    >
      {t.crud.addToMasterData}
    </a>
  );
}
