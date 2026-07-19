import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Field label rendered above the input. */
  label?: React.ReactNode;
  /** Leading icon (e.g. Lucide <Mail/>). */
  iconStart?: React.ReactNode;
  /** Trailing icon / button (e.g. password reveal). */
  iconEnd?: React.ReactNode;
  /** Error text — turns the border destructive and shows the message. */
  error?: string;
}

/**
 * Labeled text input with optional leading/trailing icons and error state.
 * Focus ring follows the active brand color.
 */
export function Input(props: InputProps): React.ReactElement;
