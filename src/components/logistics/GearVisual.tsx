import {
  Backpack,
  BatteryCharging,
  BedDouble,
  Bike,
  BriefcaseMedical,
  Cable,
  Camera,
  CircleDot,
  CookingPot,
  CupSoda,
  Droplets,
  FileText,
  Flame,
  Flashlight,
  Footprints,
  Glasses,
  HardHat,
  Link,
  LockKeyhole,
  Map,
  Navigation,
  Package,
  ShieldPlus,
  Shirt,
  Smartphone,
  Sparkles,
  TentTree,
  Utensils,
  WalletCards,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  battery: BatteryCharging,
  bike: Bike,
  bag: Backpack,
  camera: Camera,
  chain: Link,
  clothing: Shirt,
  cooking: CookingPot,
  documents: FileText,
  filter: Droplets,
  fire: Flame,
  food: Utensils,
  fuel: Flame,
  glasses: Glasses,
  glove: ShieldPlus,
  hat: HardHat,
  helmet: HardHat,
  hygiene: Sparkles,
  jacket: Shirt,
  light: Flashlight,
  lock: LockKeyhole,
  map: Map,
  medical: BriefcaseMedical,
  mug: CupSoda,
  navigation: Navigation,
  package: Package,
  patch: CircleDot,
  phone: Smartphone,
  pump: Cable,
  safety: ShieldPlus,
  shirt: Shirt,
  shoe: Footprints,
  shorts: Shirt,
  sleep: BedDouble,
  sock: Footprints,
  tent: TentTree,
  tube: CircleDot,
  utensils: Utensils,
  wallet: WalletCards,
  water: Droplets,
  wrench: Wrench,
};

export function GearVisual({ imageKey, label, compact = false }: { imageKey?: string; label: string; compact?: boolean }) {
  const Icon = icons[imageKey ?? "package"] ?? Package;
  return (
    <div
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#86b9b0]/16 bg-[radial-gradient(circle_at_30%_20%,rgba(134,185,176,0.25),transparent_58%),linear-gradient(145deg,rgba(76,114,115,0.22),rgba(4,20,33,0.8))] text-[#a9d1c9] ${compact ? "size-11" : "aspect-square w-full"}`}
      role="img"
      aria-label={`${label} illustration`}
    >
      <Icon className={compact ? "size-5" : "size-10"} strokeWidth={1.45} />
      {!compact && <span className="absolute inset-x-3 bottom-2 h-px bg-gradient-to-r from-transparent via-[#86b9b0]/22 to-transparent" />}
    </div>
  );
}
