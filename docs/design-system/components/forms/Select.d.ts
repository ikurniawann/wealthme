import * as React from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: React.ReactNode;
  /** Options as strings or {value,label} objects. */
  options?: (string | SelectOption)[];
  /** Empty-value placeholder option. */
  placeholder?: string;
  error?: string;
}

/**
 * Native select styled to match Input — same height, border, focus ring.
 */
export function Select(props: SelectProps): React.ReactElement;
