"use client";

import { useState, type ReactNode } from "react";

import type { FamilyMember } from "./beneficiary-editor";

/** Label + control + helper/error, error announced next to the field. */
export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`field mt-0 ins3f-field ${className ?? ""}`}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="error-text" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p className="hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Native date input: clearable, keyboard friendly, ≥16px on phones. */
export function DateInput({
  id,
  value,
  onChange,
  max,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  max?: string;
  invalid?: boolean;
}) {
  return (
    <input
      id={id}
      type="date"
      className="input ins3f-input"
      value={value}
      max={max}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/**
 * A role (holder / payer): a family member, or a free-text name for someone
 * outside the family. Roles are separate fields — never one "Pemilik".
 */
export function PersonPicker({
  id,
  label,
  members,
  userId,
  name,
  otherLabel,
  nonePh,
  namePh,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  members: FamilyMember[];
  userId: string;
  name: string;
  otherLabel: string;
  nonePh: string;
  namePh: string;
  hint?: string;
  onChange: (next: { userId: string; name: string }) => void;
}) {
  const OTHER = "__other__";
  const [isOther, setIsOther] = useState(!userId && Boolean(name));
  const mode = userId ? userId : isOther ? OTHER : "";
  return (
    <Field id={id} label={label} hint={hint}>
      <select
        id={id}
        className="select ins3f-input"
        value={mode}
        onChange={(e) => {
          const v = e.target.value;
          setIsOther(v === OTHER);
          onChange({ userId: v === OTHER ? "" : v, name: "" });
        }}
      >
        <option value="">{nonePh}</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name}
          </option>
        ))}
        <option value={OTHER}>{otherLabel}</option>
      </select>
      {mode === OTHER && (
        <input
          className="input ins3f-input mt-2"
          aria-label={`${label} — ${namePh}`}
          placeholder={namePh}
          autoComplete="name"
          enterKeyHint="next"
          value={name}
          onChange={(e) => onChange({ userId: "", name: e.target.value })}
        />
      )}
    </Field>
  );
}
