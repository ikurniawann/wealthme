"use client";

import Link from "next/link";

/** WealthMe app mark (gradient tile with the white ribbon W). */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/wealthme-mark.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="wm-brand-img"
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
    />
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
