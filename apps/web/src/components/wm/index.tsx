/**
 * WealthMe shared primitives.
 *
 * EPIC-026 design-system migration: the implementations moved into focused
 * sibling files and now render the prototype's real class names from
 * `app/design-system.css`. This barrel keeps every existing
 * `@/components/wm` import working unchanged.
 */

export { SectionCard, CardLink } from "./section-card";
export { StatusBadge, type StatusBadgeVariant } from "./badge";
export { ProgressBar } from "./progress-bar";
export { SummaryCard, MoneyStat } from "./stat";
export { HeroCard, HeroLabel, HeroValue } from "./hero-card";
// Bento v2 kit (UI revamp) — see src/app/bento.css.
export {
  accountTone,
  AddTile,
  type CardTone,
  ARow,
  BentoCard,
  BentoGrid,
  BentoTile,
  BentoTiles,
  ChipPicker,
  CompositionStack,
  Delta,
  GhostButton,
  HatchedBar,
  BentoHero,
  HeroKpi,
  InlineEditor,
  MiniList,
  MiniRow,
  MoneyInput,
  PillButton,
  SeeAll,
  Segmented,
  TipsCard,
  Track,
  type CompositionItem,
} from "./bento";
export { GoalIcon, goalIconKind, type GoalIconKind } from "./goal-icon";
export {
  AccountCard,
  CARD_PATTERNS,
  CARD_SKINS,
  defaultLook,
  useCardLooks,
  type CardLook,
  type CardPattern,
  type CardSkin,
} from "./account-card";
export { DetailPanel } from "./detail-panel";
export { CardSkinPanel, type CardSkinPreview } from "./card-skin-panel";
export { FinancialDialog } from "./financial-dialog";
export { showUndoToast } from "./undo-toast";

// Design-system enhancement layer (EPIC-013)
export * from "./motion";
export { IconChip } from "./icon-chip";
// Searchable emoji picker — replaces the fixed 8/10-emoji grids that used to
// stand in for an icon chooser in the budget and category dialogs.
export { EmojiPicker } from "./emoji-picker";
// EPIC-032 — (i) popover that replaces explainer copy across pages.
export { InfoTip } from "./info-tip";
// Revisi C — the one app-wide date picker (range + single date), portaled.
export { DateField, DateRangeFilterField } from "./date-range-field";
// uiarc.dev `context-menu` reference, adapted onto Base UI's own context-menu primitive.
export { ContextMenu, type ContextMenuAction } from "./context-menu";
