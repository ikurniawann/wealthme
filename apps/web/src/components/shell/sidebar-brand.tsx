"use client";

import Link from "next/link";

/** The prototype's lime "W" mark: a zig-zag stroke on a rounded lime tile. */
export function BrandMark({ size = 15 }: { size?: number }) {
  return (
    <span className="wm-brand-mark" aria-hidden="true">
      <svg
        width={size}
        height={size}
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
  );
}

/** Sidebar brand; the logo is the Home link (A4 revisi-2). */
export function SidebarBrand({ href = "/beranda" }: { href?: string }) {
  return (
    <Link href={href} className="wm-brand" aria-label="WealthMe, beranda">
      <BrandMark />
      <span>WealthMe</span>
    </Link>
  );
}
