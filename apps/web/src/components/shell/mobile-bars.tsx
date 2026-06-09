"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Plus, Search } from "lucide-react";
import { useState } from "react";

import { NotifBell } from "@/components/NotifBell";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PAGE_TITLES, MOBILE_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

import { SidebarNav } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { useShell } from "./shell-context";

export function MobileHeader() {
  const pathname = usePathname();
  const seg = pathname.split("/")[1] || "beranda";
  const title = PAGE_TITLES[seg] ?? "WealthMe";
  const { setSearchOpen } = useShell();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="sticky top-0 z-50 flex h-14 items-center gap-2.5 border-b bg-card px-4 md:hidden">
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger
          aria-label="Buka menu"
          className="flex size-9 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
        >
          <Menu className="size-[15px]" />
        </SheetTrigger>
        <SheetContent side="left" className="w-[260px] p-0">
          <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
          <SidebarNav onNavigate={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 text-lg font-extrabold">{title}</div>
      <div className="flex gap-1.5">
        <ThemeToggle />
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Cari"
          className="flex size-9 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
        >
          <Search className="size-[15px]" />
        </button>
        <NotifBell />
      </div>
    </div>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const { setTxnOpen } = useShell();
  const left = MOBILE_NAV.slice(0, 2);
  const right = MOBILE_NAV.slice(2);

  const renderItem = (item: (typeof MOBILE_NAV)[number]) => {
    const Icon = item.icon;
    const active = pathname === item.href;
    return (
      <Link
        key={item.id}
        href={item.href}
        className={cn(
          "flex flex-col items-center gap-0.5 rounded-md px-3 py-1.5 transition-colors",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Icon className="size-[18px]" />
        <span className="text-[10px] font-semibold">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex h-[60px] items-center justify-around border-t bg-card px-2 md:hidden">
      {left.map(renderItem)}
      <button
        onClick={() => setTxnOpen(true)}
        aria-label="Tambah transaksi"
        className="flex size-12 items-center justify-center rounded-full bg-primary text-white shadow-[0_4px_16px_rgba(79,70,229,0.4)] transition-transform hover:scale-105"
      >
        <Plus className="size-5" />
      </button>
      {right.map(renderItem)}
    </div>
  );
}
