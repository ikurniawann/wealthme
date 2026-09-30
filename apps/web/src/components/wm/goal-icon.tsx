"use client";

import type { ComponentType } from "react";
import { ChartLine } from "@/components/animate-ui/icons/chart-line";
import { Compass } from "@/components/animate-ui/icons/compass";
import { Gauge } from "@/components/animate-ui/icons/gauge";
import { Heart } from "@/components/animate-ui/icons/heart";
import { HouseWifi } from "@/components/animate-ui/icons/house-wifi";
import { Key } from "@/components/animate-ui/icons/key";
import { Lightbulb } from "@/components/animate-ui/icons/lightbulb";
import { LockKeyhole } from "@/components/animate-ui/icons/lock-keyhole";
import { PartyPopper } from "@/components/animate-ui/icons/party-popper";
import { Route } from "@/components/animate-ui/icons/route";
import { Sparkles } from "@/components/animate-ui/icons/sparkles";
import { Star } from "@/components/animate-ui/icons/star";
import { Sun } from "@/components/animate-ui/icons/sun";
import { Users } from "@/components/animate-ui/icons/users";

type AnimatedIcon = ComponentType<{
  size?: number;
  animateOnHover?: boolean;
  className?: string;
}>;

export type GoalIconKind =
  | "safety"
  | "home"
  | "travel"
  | "holiday"
  | "vehicle"
  | "education"
  | "love"
  | "celebration"
  | "invest"
  | "family"
  | "retirement"
  | "wish"
  | "key"
  | "other";

const ICONS: Record<GoalIconKind, AnimatedIcon> = {
  safety: LockKeyhole,
  home: HouseWifi,
  travel: Compass,
  holiday: Sun,
  vehicle: Route,
  education: Lightbulb,
  love: Heart,
  celebration: PartyPopper,
  invest: ChartLine,
  family: Users,
  retirement: Gauge,
  wish: Star,
  key: Key,
  other: Sparkles,
};

/** Goals store the emoji a member picked; these map it onto the animated set. */
const EMOJI: [string[], GoalIconKind][] = [
  [["🛡", "🆘", "🚨", "⛑"], "safety"],
  [["🏠", "🏡", "🏘", "🏢", "🏗"], "home"],
  [["✈", "🧳", "🗺", "🌍", "🌏", "🌎", "🕌", "🕋"], "travel"],
  [["🏖", "🏝", "🌴", "☀", "⛱"], "holiday"],
  [["🚗", "🚙", "🏍", "🛵", "🚲", "🚘"], "vehicle"],
  [["🎓", "📚", "🏫", "✏", "📖"], "education"],
  [["💍", "❤", "💒", "👰", "💕", "👶", "🍼"], "love"],
  [["🎉", "🎁", "🎂", "🥳"], "celebration"],
  [["📈", "💰", "💵", "🏦", "💎", "🪙", "💹"], "invest"],
  [["👨", "👩", "👪", "🧑"], "family"],
  [["👴", "👵", "🏖️‍", "⏳"], "retirement"],
  [["⭐", "🌟", "✨"], "wish"],
  [["🔑", "🗝"], "key"],
];

/** Fallback on the goal's own name when there is no (known) emoji. */
const WORDS: [RegExp, GoalIconKind][] = [
  [/darurat|emergency|cadangan/i, "safety"],
  [/pensiun|retire/i, "retirement"],
  [/rumah|kpr|house|home|apartemen/i, "home"],
  [/liburan|holiday|vacation|pantai/i, "holiday"],
  [/umroh|umrah|haji|travel|jalan|trip/i, "travel"],
  [/mobil|motor|kendaraan|car|vehicle/i, "vehicle"],
  [/sekolah|kuliah|pendidikan|school|college|kursus/i, "education"],
  [/nikah|wedding|bayi|baby|lahir/i, "love"],
  [/investasi|saham|invest|reksa/i, "invest"],
];

export function goalIconKind(
  icon: string | null | undefined,
  name = "",
): GoalIconKind {
  if (icon)
    for (const [marks, kind] of EMOJI)
      if (marks.some((mark) => icon.includes(mark))) return kind;
  for (const [pattern, kind] of WORDS) if (pattern.test(name)) return kind;
  return "other";
}

/** Animated goal icon (animate-ui), plays on hover of the icon or of an ancestor `AnimateIcon`. */
export function GoalIcon({
  icon,
  name,
  size = 18,
  className,
}: {
  icon?: string | null;
  name?: string;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[goalIconKind(icon, name)];
  return <Icon size={size} animateOnHover className={className} />;
}
