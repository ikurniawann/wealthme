"use client";

import { ArcButton } from "./arc-button";

export function ArcButtonProbe({
  label,
  disabled = false,
  loading = false,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}) {
  return (
    <>
      <ArcButton disabled={disabled} loading={loading} onClick={onClick}>
        {label}
      </ArcButton>
      {loading && (
        <span role="status" className="sr-only">
          Memproses {label}
        </span>
      )}
    </>
  );
}
