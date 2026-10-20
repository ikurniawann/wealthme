"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import { useMyAccess } from "@/hooks/use-my-access";
import { mobileNavForAccess } from "@/lib/nav";
import { usePendingApprovals } from "@/components/shell/sidebar-sections";
import {
  buildMenuSections,
  filterMenuSections,
  type MenuRow,
  type MenuSection,
} from "./menu-sections";
import "./menu.css";

function MenuLink({
  row,
  count,
  countLabel,
}: {
  row: MenuRow;
  /** Pending items behind this link; only a real, positive count shows. */
  count?: number;
  countLabel?: string;
}) {
  const Icon = row.icon;
  return (
    <li>
      <Link
        href={row.href}
        className="mn-row"
        aria-label={count ? `${row.label}, ${countLabel}` : undefined}
      >
        <span className="mn-row-ic" aria-hidden="true">
          <Icon />
        </span>
        <span className="mn-row-lbl">{row.label}</span>
        {count ? (
          <span className="mn-badge" aria-hidden="true">
            {count}
          </span>
        ) : null}
        <ChevronRight className="mn-row-chev" aria-hidden="true" />
      </Link>
    </li>
  );
}

/**
 * Phone navigation page (2026-10-20 reference "Menu · halaman navigasi"),
 * opened from the dock's Menu item. The shell draws the brand row (wordmark,
 * bell, avatar) and the "Menu" title; this renders the search, the family
 * row and the grouped links. Above 720px it is the same list, centred.
 */
export default function MenuPage() {
  const { t } = useLocale();
  const { access } = useMyAccess();
  const [query, setQuery] = useState("");
  const searchId = useId();
  const copy = t.shell.phone.menu;

  const dockIds = mobileNavForAccess(access).map((item) => item.id);
  const sections = buildMenuSections(t, access, dockIds);
  const approvalsVisible = sections.some((section) =>
    section.rows.some((row) => row.id === "persetujuan"),
  );
  const pending = usePendingApprovals(approvalsVisible);
  const shown = filterMenuSections(sections, query);

  const countFor = (row: MenuRow) =>
    row.id === "persetujuan" && pending > 0 ? pending : undefined;

  const renderSection = (section: MenuSection) => {
    const grid = section.rows.length > 2;
    const list = (
      <ul
        className="mn-card"
        data-grid={grid || undefined}
        data-odd={(grid && section.rows.length % 2 === 1) || undefined}
      >
        {section.rows.map((row) => (
          <MenuLink
            key={row.id}
            row={row}
            count={countFor(row)}
            countLabel={copy.pendingCount.replace("{n}", String(pending))}
          />
        ))}
      </ul>
    );
    if (!section.title) {
      return (
        <nav key={section.id} aria-label={section.rows[0]?.label}>
          {list}
        </nav>
      );
    }
    const headingId = `${searchId}-${section.id}`;
    return (
      <section key={section.id} aria-labelledby={headingId} className="mn-sec">
        <h2 id={headingId}>{section.title}</h2>
        {list}
      </section>
    );
  };

  return (
    <div className="mn">
      <div className="mn-search">
        <Search aria-hidden="true" />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.search}
          aria-label={copy.searchLabel}
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>
      {shown.length > 0 ? (
        shown.map(renderSection)
      ) : (
        <p className="mn-empty" role="status">
          {copy.noResults}
        </p>
      )}
    </div>
  );
}
