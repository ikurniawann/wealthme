import {
  ChartColumn,
  Bitcoin,
  FileText,
  Gem,
  LayoutGrid,
  Percent,
  Sprout,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TYPES } from "./portfolio-model";

/** One recognisable glyph per investment type (chips, cards, activity). */
export const TYPE_ICONS: Record<(typeof TYPES)[number], LucideIcon> = {
  saham: ChartColumn,
  reksa_dana: Sprout,
  obligasi: FileText,
  emas: Gem,
  kripto: Bitcoin,
  deposito: Percent,
  lainnya: LayoutGrid,
};
