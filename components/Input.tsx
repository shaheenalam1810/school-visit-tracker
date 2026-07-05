import { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: ReactNode;
  hint?: string;
}

export default function Input({ label, icon, hint, id, className = "", ...rest }: InputProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="w-full">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink-700 font-body">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className={`w-full rounded-xl border border-ink-100 bg-white py-3.5 text-base text-ink-900 placeholder:text-ink-300 outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-200 ${
            icon ? "pl-10 pr-4" : "px-4"
          } ${className}`}
          {...rest}
        />
      </div>
      {hint && <p className="mt-1 text-xs text-ink-400 font-body">{hint}</p>}
    </div>
  );
}
