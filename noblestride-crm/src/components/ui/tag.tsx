import { cn } from "@/lib/cn";

interface TagProps {
  label: string;
  color?: string;
  className?: string;
}

/**
 * Tag — a small pill label, optionally tinted by a hex color prop.
 * Used for free-form labels (e.g. geographic tags, custom attributes).
 */
export function Tag({ label, color, className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
        className
      )}
      style={color ? { backgroundColor: color + "1a", color, borderColor: color + "33" } : undefined}
    >
      {label}
    </span>
  );
}
