import React from "react";

/**
 * WealthMe Select — native-backed select styled to match Input. Optional
 * label. Chevron drawn with CSS. Focus ring follows --primary.
 */
export function Select({
  label,
  options = [],
  placeholder,
  error,
  style,
  id,
  children,
  ...props
}) {
  const [focus, setFocus] = React.useState(false);
  const selectId = id || React.useId();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label && (
        <label
          htmlFor={selectId}
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
        <select
          id={selectId}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            width: "100%",
            height: 38,
            padding: "0 34px 0 12px",
            borderRadius: "var(--radius-md)",
            border: `1px solid ${error ? "var(--destructive)" : focus ? "var(--primary)" : "var(--input)"}`,
            background: "var(--card)",
            color: "var(--foreground)",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            outline: "none",
            appearance: "none",
            cursor: "pointer",
            boxShadow: focus
              ? `0 0 0 3px color-mix(in oklab, var(--ring) 18%, transparent)`
              : "none",
            transition: "border-color .15s, box-shadow .15s",
          }}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => {
            const opt = typeof o === "string" ? { value: o, label: o } : o;
            return (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            );
          })}
          {children}
        </select>
        <span
          style={{
            position: "absolute",
            right: 12,
            pointerEvents: "none",
            color: "var(--muted-foreground)",
            fontSize: 11,
          }}
        >
          ▾
        </span>
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
