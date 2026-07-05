import { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { label: string; value: string }[];
  placeholder?: string;
}

export default function Select({
  label,
  options,
  placeholder = "Select...",
  id,
  className = "",
  ...rest
}: SelectProps) {
  const selectId = id || label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="w-full">
      <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-ink-700 font-body">
        {label}
      </label>
      <select
        id={selectId}
        className={`w-full rounded-xl border border-ink-100 bg-white px-4 py-3.5 text-base text-ink-900 outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-200 ${className}`}
        {...rest}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
