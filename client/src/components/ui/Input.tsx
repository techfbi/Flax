import {
  type InputHTMLAttributes,
  type ReactNode,
  useState,
  forwardRef,
} from "react";
import { Eye, EyeOff } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  rightIcon?: ReactNode;
}

/**
 * Shared text/email/password input.
 * Focus ring uses pawpaw (dark: black-pawpaw).
 * Errors shown in pawpaw red below the field.
 * Password type: renders an eye-toggle icon automatically.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, hint, rightIcon, type, className = "", id, ...rest },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const resolvedType = isPassword && showPassword ? "text" : type;

    const inputBase =
      "w-full bg-[#F6F6F6] dark:bg-[#121212] " +
      "border border-cocoa/20 dark:border-dark-white/20 " +
      "rounded-lg px-4 py-3 text-sm text-cocoa dark:text-dark-white " +
      "placeholder:text-cocoa/40 dark:placeholder:text-dark-white/30 " +
      "transition-colors duration-150 outline-none " +
      "focus:border-moringa-faded focus:ring-1 focus:ring-moringa-faded/50 " +
      "autofill:bg-[#F6F6F6] dark:autofill:bg-[#121212] " +
      "autofill:text-cocoa dark:autofill:text-dark-white " +
      (error ? "border-rose-500 dark:border-rose-700 " : "") +
      (isPassword || rightIcon ? "pr-11 " : "");

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={id}
            className="font-heading text-sm font-medium text-cocoa dark:text-dark-white"
          >
            {label}
          </label>
        )}

        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={resolvedType}
            className={`${inputBase} ${className}`}
            {...rest}
          />

          {/* Password visibility toggle */}
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa/40 dark:text-dark-white/40 hover:text-cocoa dark:hover:text-dark-white transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          )}

          {/* Optional right icon (non-password) */}
          {!isPassword && rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa/40 dark:text-dark-white/40">
              {rightIcon}
            </span>
          )}
        </div>

        {/* Field-level error or hint */}
        {error && (
          <p className="text-xs text-rose-500 dark:text-rose-700" role="alert">
            {error}
          </p>
        )}
        {hint && !error && <p className="text-xs text-cocoa-faded">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
