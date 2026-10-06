"use client";

import { ChevronDown } from "lucide-react";

import { CURRENCIES, type CurrencyCode } from "@/hooks/currencies";
import { useLocale } from "@/hooks/use-locale";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MoneyCurrencyPicker({
  value,
  onChange,
  className,
  disabled,
}: {
  value: CurrencyCode;
  onChange: (currency: CurrencyCode) => void;
  className?: string;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const current = CURRENCIES.find((currency) => currency.code === value)!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-[13px] font-bold text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          className,
        )}
        aria-label={t.money.currencyLabel}
        disabled={disabled}
      >
        <span aria-hidden="true">{current.flag}</span>
        <span>{current.code}</span>
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[240px]">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(code) => onChange(code as CurrencyCode)}
        >
          {CURRENCIES.map((currency) => (
            <DropdownMenuRadioItem
              key={currency.code}
              value={currency.code}
              className="gap-2.5 py-2 pr-8"
            >
              <span aria-hidden="true" className="text-base">
                {currency.flag}
              </span>
              <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                <span className="font-bold">{currency.code}</span>
                <span className="truncate text-muted-foreground">
                  {t.akun.pengaturan.currencies[currency.code].name}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
