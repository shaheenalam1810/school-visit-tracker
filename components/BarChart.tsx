import { memo } from "react";

export interface BarChartDatum {
  label: string;
  value: number;
  colorClass?: string;
}

interface BarChartProps {
  data: BarChartDatum[];
  barColorClass?: string;
  emptyLabel?: string;
}

/**
 * Lightweight horizontal bar chart — plain HTML/CSS, no charting
 * library. Values are always direct-labeled (not hover-only), which
 * reads better than tooltips on touch devices.
 */
function BarChart({ data, barColorClass = "bg-amber-500", emptyLabel = "No data yet." }: BarChartProps) {
  if (data.length === 0) {
    return <p className="text-center text-sm font-body text-ink-400">{emptyLabel}</p>;
  }

  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex flex-col gap-3">
      {data.map((d) => {
        const pct = Math.round((d.value / max) * 100);
        return (
          <div key={d.label}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs font-body text-ink-600">
              <span className="truncate" title={d.label}>
                {d.label}
              </span>
              <span className="flex-shrink-0 font-semibold text-ink-900">{d.value}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-50">
              <div
                className={`h-full rounded-full ${d.colorClass || barColorClass}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(BarChart);
