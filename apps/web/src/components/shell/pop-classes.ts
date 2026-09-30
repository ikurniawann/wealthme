/**
 * Bento v2 popover look (`.pop` / `.pop .mi` in docs/design/proto/wm.css) as
 * utilities: the dropdown primitive's own utilities would outrank a
 * components-layer class, so tailwind-merge has to replace them instead.
 */
export const POP_CLASS =
  "wm-pop rounded-[18px] bg-[var(--wm-card)] p-2 text-[var(--wm-ink)] shadow-[0_24px_60px_-20px_rgb(20_30_5/0.4)] ring-[var(--wm-line)]";

export const POP_ITEM_CLASS =
  "wm-mi min-h-11 gap-3 rounded-[12px] px-3 py-2.5 text-[14px] focus:bg-[var(--wm-card-2)] focus:text-[var(--wm-ink)] [&_svg:not([class*='size-'])]:size-[17px]";
