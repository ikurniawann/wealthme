import React from "react";

/**
 * WealthMe Input — text field with optional leading icon and label. Focus
 * ring follows --primary. Used across auth, CRUD modals, quick input.
 */
export function Input({
  label,
  iconStart,
  iconEnd,
  error,
  className,
  style,
  id,
  ...props
}) {
  const [focus, setFocus] = React.useState(false);
  const inputId = id || React.useId();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--foreground)",
          }}
        >
          {label}
        </label>
      )}
      <div
        style={{ position: "relative", display: "flex", alignItems: "center" }}
      >
        {iconStart && (
          <span
            style={{
              position: "absolute",
              left: 12,
              display: "flex",
              color: "var(--muted-foreground)",
              pointerEvents: "none",
            }}
          >
            {iconStart}
          </span>
        )}
        <input
          id={inputId}
          onFocus={(e) => {
            setFocus(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            props.onBlur?.(e);
          }}
          style={{
            width: "100%",
            height: 38,
            padding: `0 ${iconEnd ? 38 : 12}px 0 ${iconStart ? 36 : 12}px`,
            borderRadius: "var(--radius-md)",
            border: `1px solid ${error ? "var(--destructive)" : focus ? "var(--primary)" : "var(--input)"}`,
            background: "var(--card)",
            color: "var(--foreground)",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            outline: "none",
            boxShadow: focus
              ? `0 0 0 3px color-mix(in oklab, var(--ring) 18%, transparent)`
              : "none",
            transition: "border-color .15s, box-shadow .15s",
          }}
          {...props}
        />
        {iconEnd && (
          <span
            style={{
              position: "absolute",
              right: 12,
              display: "flex",
              color: "var(--muted-foreground)",
            }}
          >
            {iconEnd}
          </span>
        )}
      </div>
      {error && (
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            color: "var(--destructive)",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
