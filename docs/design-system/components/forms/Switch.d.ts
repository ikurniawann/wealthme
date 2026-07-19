import * as React from "react";

export interface SwitchProps {
  /** Controlled on/off. */
  checked?: boolean;
  /** Uncontrolled initial value. @default false */
  defaultChecked?: boolean;
  /** Fired with the next value on toggle. */
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}

/**
 * Compact on/off toggle — settings, balance masking, notification prefs.
 */
export function Switch(props: SwitchProps): React.ReactElement;
