import type { ComponentProps, ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

type InputProps = Omit<ComponentProps<"input">, "id" | "className" | "type">;

export type AuthReveal = {
  show: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
};

export function AuthField({
  id,
  label,
  error,
  hint,
  reveal,
  type = "text",
  children,
  ...input
}: InputProps & {
  id: string;
  label: string;
  type?: string;
  error?: string;
  hint?: ReactNode;
  reveal?: AuthReveal;
  children?: ReactNode;
}) {
  const inputType = reveal ? (reveal.show ? "text" : "password") : type;
  return (
    <div className="au-field">
      <label htmlFor={id}>{label}</label>
      <div className="au-inputwrap" data-pw={!!reveal}>
        <input
          id={id}
          type={inputType}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...input}
        />
        {reveal && (
          <button
            type="button"
            className="au-eye"
            aria-label={reveal.show ? reveal.hideLabel : reveal.showLabel}
            aria-pressed={reveal.show}
            onClick={reveal.onToggle}
          >
            {reveal.show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {children}
      {hint && <p className="au-hint">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="au-err">
          {error}
        </p>
      )}
    </div>
  );
}
