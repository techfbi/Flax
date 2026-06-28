import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "google";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
  fullWidth?: boolean;
}

/**
 * Shared button.
 * - primary: moringa fill (dark: moringa-faded)
 * - secondary: outlined moringa
 * - ghost: no bg, text only, fades on hover
 * - google: #D9D9D9 fill (dark: #343434)
 * Spinner only shown when loading=true (major action buttons only).
 */
export const Button = ({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonProps) => {
  const base =
    "inline-flex items-center justify-center gap-2 font-body font-bold " +
    "rounded-lg transition-colors duration-150 focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-pawpaw focus-visible:ring-offset-2 " +
    "disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const sizes: Record<Size, string> = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base",
  };

  const variants: Record<Variant, string> = {
    primary:
      "bg-moringa text-surface hover:bg-[#255040] " +
      "dark:bg-moringa-faded dark:text-dark-white dark:hover:bg-[#6a9e83]",
    secondary:
      "border border-moringa text-moringa hover:bg-moringa hover:text-surface " +
      "dark:border-moringa-faded dark:text-moringa-faded dark:hover:bg-moringa-faded dark:hover:text-dark-white",
    ghost:
      "text-cocoa hover:text-moringa dark:text-dark-white dark:hover:text-moringa-faded",
    google:
      "bg-[#D9D9D9] text-cocoa hover:bg-[#c8c8c8] " +
      "dark:bg-[#343434] dark:text-dark-white dark:hover:bg-[#404040]",
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin shrink-0" />}
      {children}
    </button>
  );
};
