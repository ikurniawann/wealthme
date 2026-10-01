import type { ReactNode } from "react";
import Link from "next/link";
import { Scale, Target, Users, Gift, ShieldCheck } from "lucide-react";
import "./auth-shell.css";

const FEATURE_ICONS = [Target, Scale, Users, Gift, ShieldCheck];

export function AuthBrand({ href = "/login" }: { href?: string }) {
  return (
    <Link className="au-brand" href={href}>
      <span className="au-mark" aria-hidden="true">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6l4.5 12L12 8l4.5 10L21 6" />
        </svg>
      </span>
      WealthMe
    </Link>
  );
}

export type AuthCover = {
  headline: ReactNode;
  features: readonly string[];
};

export function AuthShell({
  cover,
  wide = false,
  children,
}: {
  cover?: AuthCover;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="au-wrap">
      {cover && (
        <div className="au-cover">
          <AuthBrand />
          <p className="au-hl">{cover.headline}</p>
          <ul className="au-feat">
            {cover.features.map((text, i) => {
              const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
              return (
                <li key={text}>
                  <Icon size={15} aria-hidden="true" />
                  <span>{text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="au-main">
        <div className="au-box" data-wide={wide}>
          {!cover && (
            <div className="au-solo">
              <AuthBrand />
            </div>
          )}
          {children}
        </div>
      </div>
    </main>
  );
}
