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

// Design-system enhancement layer (EPIC-013)
export * from "./motion";
export { IconChip } from "./icon-chip";
// Searchable emoji picker — replaces the fixed 8/10-emoji grids that used to
// stand in for an icon chooser in the budget and category dialogs.
export { EmojiPicker } from "./emoji-picker";
