import { cn } from "@/lib/cn";

/** Extract up to 2 initials from a name (first letter of each of the first two words). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

/** Deterministic background color from a name (cycles through a palette). */
function deriveColor(name: string): string {
  const COLORS = [
    "bg-emerald-600",
    "bg-sky-600",
    "bg-violet-600",
    "bg-amber-600",
    "bg-rose-600",
    "bg-cyan-600",
    "bg-indigo-600",
    "bg-teal-600",
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
  const bgClass = isHex ? undefined : (color ?? deriveColor(name));

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold text-white select-none flex-shrink-0",
        SIZE[size],
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
