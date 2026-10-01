"use client";

import { useLocale } from "@/hooks/use-locale";
import {
  AccountCard,
  CARD_PATTERNS,
  CARD_SKINS,
  type CardLook,
  type CardSkin,
} from "./account-card";
import { DetailPanel } from "./detail-panel";
import { PillButton } from "./index";

const SKIN_SWATCH: Record<CardSkin, string> = {
  lime: "#9ccb3b",
  forest: "linear-gradient(150deg, #1a4b3b, #0c2b22)",
  midnight: "linear-gradient(150deg, #1f2533, #0d1017)",
  graphite: "linear-gradient(150deg, #3a3b36, #1c1d19)",
  sand: "#efdc4e",
  sky: "linear-gradient(150deg, #bfd8ef, #8fb7e0)",
  lilac: "linear-gradient(150deg, #e3cdef, #c8a2de)",
  coral: "linear-gradient(150deg, #f6b69a, #f2a247)",
};

export interface CardSkinPreview {
  name: string;
  bank: string;
  number?: string | null;
  holder: string;
  balance: string;
}

export function CardSkinPanel({
  preview,
  look,
  onChange,
  onReset,
  onClose,
}: {
  preview: CardSkinPreview | null;
  look: CardLook | null;
  onChange: (look: CardLook) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const v2 = t.rekening.v2;
  if (!preview || !look)
    return (
      <DetailPanel open={false} onOpenChange={() => {}} title="">
        {null}
      </DetailPanel>
    );
  return (
    <DetailPanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={v2.customize}
      description={preview.name}
      footer={
        <>
          <PillButton onClick={onReset}>{v2.resetLook}</PillButton>
          <PillButton variant="primary" onClick={onClose}>
            {v2.done}
          </PillButton>
        </>
      }
    >
      <AccountCard
        look={look}
        className="wm-skin-preview"
        bank={preview.bank}
        name={preview.name}
        number={preview.number}
        holder={preview.holder}
        balance={preview.balance}
      />
      <div className="wm-field">
        <span className="wm-flabel">{v2.colour}</span>
        <div
          role="radiogroup"
          aria-label={v2.colour}
          className="wm-skin-swatches"
        >
          {CARD_SKINS.map((skin) => (
            <button
              key={skin}
              type="button"
              role="radio"
              aria-checked={look.skin === skin}
              aria-label={v2.skins[skin]}
              title={v2.skins[skin]}
              className="wm-skin-swatch"
              style={{ background: SKIN_SWATCH[skin] }}
              onClick={() => onChange({ ...look, skin })}
            />
          ))}
        </div>
      </div>
      <div className="wm-field">
        <span className="wm-flabel">{v2.pattern}</span>
        <div
          role="radiogroup"
          aria-label={v2.pattern}
          className="wm-skin-patterns"
        >
          {CARD_PATTERNS.map((pattern) => (
            <button
              key={pattern}
              type="button"
              role="radio"
              aria-checked={look.pattern === pattern}
              onClick={() => onChange({ ...look, pattern })}
            >
              <span
                className="wm-plate wm-skin-dot"
                data-skin={look.skin}
                data-pattern={pattern}
                aria-hidden="true"
              />
              {v2.patterns[pattern]}
            </button>
          ))}
        </div>
      </div>
      <p className="wm-cap">{v2.deviceNote}</p>
    </DetailPanel>
  );
}
