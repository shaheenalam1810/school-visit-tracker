import { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

export default function Textarea({ label, hint, id, className = "", rows = 3, ...rest }: TextareaProps) {
  const areaId = id || label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="w-full">
      <label htmlFor={areaId} className="mb-1.5 block text-sm font-medium text-ink-700 font-body">
        {label}
      </label>
      <textarea
        id={areaId}
        rows={rows}
        className={`w-full rounded-xl border border-ink-100 bg-white px-4 py-3.5 text-base text-ink-900 placeholder:text-ink-300 outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-200 resize-none ${className}`}
        {...rest}
      />
      {hint && <p className="mt-1 text-xs text-ink-400 font-body">{hint}</p>}
    </div>
  );
}
