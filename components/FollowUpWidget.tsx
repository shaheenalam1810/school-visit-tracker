"use client";

import { memo, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CalendarClock, CalendarDays, Sparkles } from "lucide-react";
import Card from "./Card";
import { daysBetween, todayISO } from "@/lib/date";
import { VisitRecord } from "@/types";

interface FollowUpWidgetProps {
  visits: VisitRecord[];
}

type QuickBucket = "today" | "tomorrow" | "overdue" | "upcoming";

const BUCKET_META: Record<QuickBucket, { label: string; icon: typeof AlertTriangle; classes: string }> = {
  today: { label: "Today's Follow-ups", icon: CalendarClock, classes: "bg-orange-50 text-orange-600 border-orange-100" },
  tomorrow: { label: "Tomorrow", icon: CalendarDays, classes: "bg-yellow-50 text-yellow-700 border-yellow-100" },
  overdue: { label: "Overdue", icon: AlertTriangle, classes: "bg-red-50 text-red-600 border-red-100" },
  upcoming: { label: "Upcoming", icon: Sparkles, classes: "bg-green-50 text-green-600 border-green-100" },
};

const ORDER: QuickBucket[] = ["today", "tomorrow", "overdue", "upcoming"];

/**
 * Bucket derived from VisitRecord.followup — the visit's latest
 * (non-deleted) follow-up entry's next date, already computed
 * server-side (see getAllVisitsCached in Code.gs). Reusing this
 * existing field means the widget needs no extra API call beyond
 * whatever the Dashboard/Admin Dashboard already fetched; the richer,
 * per-follow-up-entry breakdown lives on /followups itself.
 */
function bucketFor(followup: string | undefined): QuickBucket | null {
  if (!followup) return null;
  const diff = daysBetween(todayISO(), followup);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return "upcoming";
}

function FollowUpWidget({ visits }: FollowUpWidgetProps) {
  const router = useRouter();

  const counts = useMemo(() => {
    const result: Record<QuickBucket, number> = { today: 0, tomorrow: 0, overdue: 0, upcoming: 0 };
    visits.forEach((v) => {
      const bucket = bucketFor(v.followup);
      if (bucket) result[bucket] += 1;
    });
    return result;
  }, [visits]);

  function goTo(filter: QuickBucket) {
    router.push(`/followups?filter=${filter}`);
  }

  const hasAlerts = counts.today > 0 || counts.overdue > 0;

  return (
    <Card className="mb-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-bold text-ink-900">Follow-ups</h2>
        <button onClick={() => router.push("/followups")} className="text-xs font-semibold text-amber-600 active:scale-95">
          View All
        </button>
      </div>

      {hasAlerts && (
        <button
          onClick={() => goTo(counts.overdue > 0 ? "overdue" : "today")}
          className="mb-3 flex w-full items-center gap-2 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2 text-left text-xs font-semibold text-red-700 active:scale-[0.99]"
        >
          <Bell className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {counts.today > 0 && `Today's Follow-ups (${counts.today})`}
            {counts.today > 0 && counts.overdue > 0 && " · "}
            {counts.overdue > 0 && `Overdue (${counts.overdue})`}
          </span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ORDER.map((b) => {
          const meta = BUCKET_META[b];
          const Icon = meta.icon;
          return (
            <button
              key={b}
              onClick={() => goTo(b)}
              className={`rounded-xl border px-3 py-2.5 text-left transition active:scale-95 ${meta.classes}`}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wide">{meta.label}</span>
              </div>
              <p className="mt-1 font-display text-xl font-bold">{counts[b]}</p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export default memo(FollowUpWidget);
