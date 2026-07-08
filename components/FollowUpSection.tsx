"use client";

import { useMemo } from "react";
import { AlertTriangle, CalendarClock, CalendarDays, Sparkles } from "lucide-react";
import Card from "./Card";
import { daysBetween, todayISO } from "@/lib/date";
import { VisitRecord } from "@/types";

interface FollowUpSectionProps {
  visits: VisitRecord[];
  onSelectVisit: (visit: VisitRecord) => void;
}

type Bucket = "overdue" | "today" | "tomorrow" | "upcoming";

const BUCKET_META: Record<Bucket, { label: string; icon: typeof AlertTriangle; classes: string; dot: string }> = {
  overdue: { label: "Overdue", icon: AlertTriangle, classes: "bg-red-50 text-red-600 border-red-100", dot: "bg-red-500" },
  today: { label: "Today", icon: CalendarClock, classes: "bg-orange-50 text-orange-600 border-orange-100", dot: "bg-orange-500" },
  tomorrow: { label: "Tomorrow", icon: CalendarDays, classes: "bg-orange-50 text-orange-600 border-orange-100", dot: "bg-orange-400" },
  upcoming: { label: "Upcoming", icon: Sparkles, classes: "bg-emerald-50 text-emerald-600 border-emerald-100", dot: "bg-emerald-500" },
};

function bucketFor(followup: string | undefined): Bucket | null {
  if (!followup) return null;
  const diff = daysBetween(todayISO(), followup);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return "upcoming";
}

export default function FollowUpSection({ visits, onSelectVisit }: FollowUpSectionProps) {
  const buckets = useMemo(() => {
    const grouped: Record<Bucket, VisitRecord[]> = { overdue: [], today: [], tomorrow: [], upcoming: [] };
    visits.forEach((v) => {
      const bucket = bucketFor(v.followup);
      if (bucket) grouped[bucket].push(v);
    });
    (Object.keys(grouped) as Bucket[]).forEach((b) => {
      grouped[b].sort((a, c) => (a.followup || "").localeCompare(c.followup || ""));
    });
    return grouped;
  }, [visits]);

  const order: Bucket[] = ["overdue", "today", "tomorrow", "upcoming"];
  const totalPending = order.reduce((sum, b) => sum + buckets[b].length, 0);

  return (
    <Card className="mb-5">
      <h2 className="mb-3 font-display text-sm font-bold text-ink-900">Pending Follow-up</h2>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {order.map((b) => {
          const meta = BUCKET_META[b];
          const Icon = meta.icon;
          return (
            <div key={b} className={`rounded-xl border px-3 py-2.5 ${meta.classes}`}>
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wide">{meta.label}</span>
              </div>
              <p className="mt-1 text-xl font-display font-bold">{buckets[b].length}</p>
            </div>
          );
        })}
      </div>

      {totalPending === 0 ? (
        <p className="text-center text-sm font-body text-ink-400">No follow-ups scheduled.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {order.flatMap((b) =>
            buckets[b].slice(0, 5).map((v, idx) => {
              const meta = BUCKET_META[b];
              return (
                <button
                  key={`${b}-${idx}-${v.visit_id || v.school_name}`}
                  onClick={() => onSelectVisit(v)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-ink-50 active:scale-[0.99]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${meta.dot}`} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-body font-semibold text-ink-900">{v.school_name}</p>
                      <p className="truncate text-xs font-body text-ink-400">{v.executive}</p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-xs font-body text-ink-500">{v.followup}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </Card>
  );
}
