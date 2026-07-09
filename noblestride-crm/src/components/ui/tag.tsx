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
        "inline-flex items-center rounded px-2.5 py-0.5 text-xs font-medium",
        "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]",
        className
      )}
      style={color ? { backgroundColor: color + "1a", color, borderColor: color + "33" } : undefined}
    >
      {label}
    </span>
  );
}
