"use client";

import { Flame, Sun, Snowflake } from "lucide-react";
import { InterestLevel } from "@/types";

interface InterestPickerProps {
  value: InterestLevel | "";
  onChange: (value: InterestLevel) => void;
}

const OPTIONS: { value: InterestLevel; label: string; icon: typeof Flame; active: string }[] = [
  { value: "Hot", label: "Hot", icon: Flame, active: "bg-red-500 border-red-500 text-white" },
  { value: "Warm", label: "Warm", icon: Sun, active: "bg-amber-500 border-amber-500 text-ink-900" },
  { value: "Cold", label: "Cold", icon: Snowflake, active: "bg-ink-500 border-ink-500 text-white" },
];

export default function InterestPicker({ value, onChange }: InterestPickerProps) {
  return (
    <div className="w-full">
      <span className="mb-1.5 block text-sm font-medium text-ink-700 font-body">
        Interest Level
      </span>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-3.5 text-sm font-semibold font-body transition-all active:scale-[0.97] ${
                isActive
                  ? opt.active
                  : "bg-white border-ink-100 text-ink-500 hover:border-ink-200"
              }`}
            >
              <Icon className="h-5 w-5" />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
