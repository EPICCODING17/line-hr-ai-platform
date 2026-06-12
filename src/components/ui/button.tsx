import { cn } from "@/lib/utils";

type Variant = "primary" | "soft" | "outline" | "ghost" | "danger";

const MAP: Record<Variant, string> = {
  primary: "btn-primary",
  soft: "btn-outline",
  outline: "btn-outline",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  loading?: boolean;
}

export function Button({ className, variant = "primary", size = "md", loading, children, disabled, style, ...props }: ButtonProps) {
  const smStyle = size === "sm" ? { height: "calc(var(--ctrl-h) - 6px)", padding: "0 calc(var(--u)*3)", fontSize: ".85em" } : undefined;
  return (
    <button className={cn("btn", MAP[variant], className)} style={{ ...smStyle, ...style }} disabled={disabled || loading} {...props}>
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}
