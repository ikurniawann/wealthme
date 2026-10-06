import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// EPIC-026 — migrated onto the prototype design system (`app/design-system.css`).
// The look now comes entirely from `.btn` + its `--primary/--outline/--ghost/
// --destructive/--sm/--icon/--block` modifiers, which are the specification.
// Only behaviour-preserving utilities are kept alongside them:
//   * `disabled:pointer-events-none` — the previous build suppressed clicks on a
//     disabled button (`.btn:disabled` only sets opacity/cursor).
//   * the `[&_svg]` rules — lucide icons ship without a size class and would
//     otherwise render at their intrinsic 24px inside a 36px-tall `.btn`.
//   * `aria-invalid:*` — keeps invalid-state surfacing that forms rely on.
// Do NOT reintroduce Tailwind colour/size/radius utilities here: `.btn` owns
// them, and a utility would silently win over the prototype (utilities layer
// is emitted after the components layer that holds design-system.css).
const buttonVariants = cva(
  "btn group/button [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 disabled:pointer-events-none aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "btn--primary",
        // The prototype has no dedicated secondary button — its neutral button
        // is `.btn--outline`, which is what `secondary` call sites want.
        outline: "btn--outline",
        secondary: "btn--outline",
        ghost: "btn--ghost",
        destructive: "btn--destructive",
        link: "btn--ghost text-primary-strong underline-offset-4 hover:underline",
      },
      size: {
        // `.btn` itself is the default (36px) size.
        default: "",
        xs: "btn--sm",
        sm: "btn--sm",
        lg: "",
        icon: "btn--icon",
        "icon-xs": "btn--icon btn--sm",
        "icon-sm": "btn--icon btn--sm",
        "icon-lg": "btn--icon",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
