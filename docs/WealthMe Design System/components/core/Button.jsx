import React from "react";

/**
 * WealthMe Button — Base-UI-derived button with the brand's variants & sizes.
 * Indigo solid default, soft-fill destructive, restrained ghost/outline.
 * Press nudges 1px down; hover lightens the fill.
 */
export function Button({
  variant = "default",
  size = "default",
  iconStart,
  iconEnd,
  disabled = false,
  className,
  style,
  children,
  ...props
}) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);

  const sizes = {
    sm: {
      height: 28,
      padding: "0 10px",
      fontSize: 12.5,
      radius: "var(--radius-sm)",
      gap: 6,
    },
    default: {
      height: 34,
      padding: "0 14px",
      fontSize: 13,
      radius: "var(--radius-md)",
      gap: 7,
    },
    lg: {
      height: 40,
      padding: "0 18px",
      fontSize: 14,
      radius: "var(--radius-md)",
      gap: 8,
    },
    icon: {
      height: 36,
      width: 36,
      padding: 0,
      fontSize: 13,
      radius: "var(--radius-md)",
      gap: 0,
    },
  };
  const s = sizes[size] || sizes.default;

  const variants = {
    default: {
      background: hover
        ? "color-mix(in oklab, var(--primary) 86%, black)"
        : "var(--primary)",
      color: "var(--primary-foreground)",
      boxShadow: "none",
      border: "1px solid transparent",
    },
    outline: {
      background: hover ? "var(--muted)" : "var(--background)",
      color: "var(--foreground)",
      border: "1px solid var(--border)",
    },
    secondary: {
      background: hover
        ? "color-mix(in oklab, var(--secondary), var(--foreground) 5%)"
        : "var(--secondary)",
      color: "var(--secondary-foreground)",
      border: "1px solid transparent",
    },
    ghost: {
      background: hover ? "var(--muted)" : "transparent",
      color: hover ? "var(--foreground)" : "var(--muted-foreground)",
      border: "1px solid transparent",
    },
    destructive: {
      background: hover
        ? "color-mix(in oklab, var(--destructive) 22%, transparent)"
        : "color-mix(in oklab, var(--destructive) 12%, transparent)",
      color: "var(--destructive)",
      border: "1px solid transparent",
    },
    link: {
      background: "transparent",
      color: "var(--primary)",
      border: "1px solid transparent",
      textDecoration: hover ? "underline" : "none",
      padding: 0,
      height: "auto",
    },
  };
  const v = variants[variant] || variants.default;

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setActive(false);
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: s.gap,
        height: variant === "link" ? "auto" : s.height,
        width: s.width,
        padding: variant === "link" ? 0 : s.padding,
        borderRadius: s.radius,
        fontFamily: "var(--font-sans)",
        fontSize: s.fontSize,
        fontWeight: 600,
        whiteSpace: "nowrap",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background .15s, transform .05s, color .15s",
        transform: active && !disabled ? "translateY(1px)" : "none",
        outline: "none",
        ...v,
        ...style,
      }}
      {...props}
    >
      {iconStart}
      {children}
      {iconEnd}
    </button>
  );
}
