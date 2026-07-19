import React from "react";

/**
 * WealthMe Switch — compact toggle. On = --primary track. Used in settings,
 * theme toggle, masking balances, notification preferences.
 */
export function Switch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  style,
  ...props
}) {
  const [internal, setInternal] = React.useState(defaultChecked);
  const isOn = checked !== undefined ? checked : internal;
  const toggle = () => {
    if (disabled) return;
    if (checked === undefined) setInternal(!isOn);
    onCheckedChange?.(!isOn);
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      disabled={disabled}
      onClick={toggle}
      style={{
        position: "relative",
        width: 38,
        height: 22,
        flexShrink: 0,
        borderRadius: "var(--radius-pill)",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        background: isOn ? "var(--primary)" : "var(--border)",
        transition: "background .2s",
        padding: 0,
        ...style,
      }}
      {...props}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: isOn ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.25)",
          transition: "left .2s",
        }}
      />
    </button>
  );
}
