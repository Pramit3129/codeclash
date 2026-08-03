import { Crown, Shield, Trophy, Gem, Medal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface League {
  name: string;
  img: string;
  range: string;
  min: number;
  share: string;
  pedestalHeight: number;
  badge: string;
  tile: string;
  color: string;
  accentHex: string;
  glow: string;
  pedestalBorder: string;
  textAccent: string;
  Icon: LucideIcon;
}

export const LEAGUES: League[] = [
  {
    name: "Legend",
    img: "/LegendBatch.png",
    min: 2050,
    range: "2050+",
    share: "1%",
    pedestalHeight: 220,
    badge: "border-amber-400/30 bg-amber-500/10 text-amber-400",
    tile: "bg-amber-500/10 text-amber-400",
    color: "bg-amber-400",
    accentHex: "#fbbf24",
    glow: "drop-shadow(0 6px 18px rgba(251, 191, 36, 0.4))",
    pedestalBorder: "border-amber-500/30 group-hover:border-amber-400/60",
    textAccent: "text-amber-400",
    Icon: Crown,
  },
  {
    name: "Titan",
    img: "/TitanBatch.png",
    min: 1900,
    range: "1900–2049",
    share: "5%",
    pedestalHeight: 185,
    badge: "border-blue-400/30 bg-blue-500/10 text-blue-400",
    tile: "bg-blue-500/10 text-blue-400",
    color: "bg-blue-400",
    accentHex: "#3b82f6",
    glow: "drop-shadow(0 6px 18px rgba(59, 130, 246, 0.4))",
    pedestalBorder: "border-blue-500/30 group-hover:border-blue-400/60",
    textAccent: "text-blue-400",
    Icon: Shield,
  },
  {
    name: "Champion",
    img: "/ChampionsBatch.png",
    min: 1750,
    range: "1750–1899",
    share: "12%",
    pedestalHeight: 150,
    badge: "border-red-400/30 bg-red-500/10 text-red-400",
    tile: "bg-red-500/10 text-red-400",
    color: "bg-red-500",
    accentHex: "#ef4444",
    glow: "drop-shadow(0 6px 18px rgba(239, 68, 68, 0.4))",
    pedestalBorder: "border-red-500/30 group-hover:border-red-400/60",
    textAccent: "text-red-400",
    Icon: Trophy,
  },
  {
    name: "Crystal",
    img: "/CrystalBatch.png",
    min: 1550,
    range: "1550–1749",
    share: "24%",
    pedestalHeight: 120,
    badge: "border-sky-400/30 bg-sky-500/10 text-sky-400",
    tile: "bg-sky-500/10 text-sky-400",
    color: "bg-sky-400",
    accentHex: "#38bdf8",
    glow: "drop-shadow(0 6px 18px rgba(56, 189, 248, 0.4))",
    pedestalBorder: "border-sky-400/30 group-hover:border-sky-300/60",
    textAccent: "text-sky-400",
    Icon: Gem,
  },
  {
    name: "Bronze",
    img: "/BronzeBatch.png",
    min: 0,
    range: "0–1549",
    share: "58%",
    pedestalHeight: 92,
    badge: "border-amber-700/30 bg-amber-800/10 text-amber-500",
    tile: "bg-amber-800/10 text-amber-500",
    color: "bg-amber-700",
    accentHex: "#d97706",
    glow: "drop-shadow(0 6px 18px rgba(217, 119, 6, 0.4))",
    pedestalBorder: "border-amber-700/30 group-hover:border-amber-500/60",
    textAccent: "text-amber-500",
    Icon: Medal,
  },
];

export function getLeague(rating: number): League {
  return (
    LEAGUES.find((league) => rating >= league.min) ??
    LEAGUES[LEAGUES.length - 1]
  );
}
