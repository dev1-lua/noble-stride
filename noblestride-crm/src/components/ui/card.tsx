import { cn } from "@/lib/cn";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Card — white rounded-lg surface with zinc-200 border and subtle shadow.
 * All layout/padding is up to the caller.
 */
export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-white border border-zinc-200 shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardHeader({ children, className, ...props }: CardHeaderProps) {
  return (
    <div className={cn("px-5 py-4 border-b border-zinc-100", className)} {...props}>
      {children}
    </div>
  );
}

interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardBody({ children, className, ...props }: CardBodyProps) {
  return (
    <div className={cn("px-5 py-4", className)} {...props}>
      {children}
    </div>
  );
}
