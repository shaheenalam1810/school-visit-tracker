"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  isLoading?: boolean;
  fullWidth?: boolean;
}

export default function Button({
  children,
  variant = "primary",
  isLoading = false,
  fullWidth = true,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl2 px-5 py-4 text-base font-semibold font-display transition-all active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100";

  const variants: Record<string, string> = {
    primary:
      "bg-amber-500 text-ink-900 shadow-card hover:bg-amber-600 hover:shadow-cardHover",
    secondary:
      "bg-ink-800 text-white shadow-card hover:bg-ink-700 hover:shadow-cardHover",
    ghost: "bg-transparent text-ink-800 border border-ink-100 hover:bg-ink-50",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${
        fullWidth ? "w-full" : ""
      } ${className}`}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
      {children}
    </button>
  );
}
