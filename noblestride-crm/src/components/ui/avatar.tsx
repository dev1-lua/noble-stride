import { cn } from "@/lib/cn";

/** Extract up to 2 initials from a name (first letter of each of the first two words). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

/**
 * Deterministic monogram styling from a name. Soft, cohesive cool-tinted family
 * (light bg + colored initials) — not saturated rainbow circles. Returns both the
 * background and the matching text color as one class string.
 */
function deriveColor(name: string): string {
  const COLORS = [
    "bg-emerald-100 text-emerald-700",
    "bg-teal-100 text-teal-700",
    "bg-sky-100 text-sky-700",
    "bg-indigo-100 text-indigo-700",
    "bg-slate-100 text-slate-600",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

const SIZE = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
} as const;

interface AvatarProps {
  name: string;
  /** Override background with a Tailwind bg-* class or hex color */
  color?: string;
  size?: keyof typeof SIZE;
  className?: string;
}

/**
 * Avatar — renders a colored circle with derived initials.
 * `color` can be a Tailwind bg-* class (e.g. "bg-sky-500") or a hex/CSS color string.
 */
export function Avatar({ name, color, size = "md", className }: AvatarProps) {
  const abbr = initials(name);
  const isHex = color && (color.startsWith("#") || color.startsWith("rgb"));
  // An explicit color override is assumed saturated → white text. The default
  // derived monogram carries its own (colored) text class.
  const useWhiteText = Boolean(color);
  const bgClass = isHex ? undefined : (color ?? deriveColor(name));

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold select-none flex-shrink-0 ring-1 ring-inset ring-black/[0.06]",
        SIZE[size],
        useWhiteText && "text-white",
        !isHex && bgClass,
        className
      )}
      style={isHex ? { backgroundColor: color } : undefined}
      aria-label={name}
    >
      {abbr}
    </span>
  );
}
