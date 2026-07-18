"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { BarChart3, Users as UsersIcon, Flame } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Loader from "@/components/Loader";
import type { BarChartDatum } from "@/components/BarChart";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getVisits } from "@/lib/api";
import { VisitRecord } from "@/types";

const BarChart = dynamic(() => import("@/components/BarChart"), {
  ssr: false,
  loading: () => <div className="h-32 animate-pulse rounded-lg bg-ink-50" />,
});

const MONTHS_TO_SHOW = 6;
const TOP_USERS_TO_SHOW = 8;

function lastNMonths(n: number): { key: string; label: string }[] {
  const now = new Date();
  const result: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "short", year: "numeric" });
    result.push({ key, label });
  }
  return result;
}

function AnalyticsContent() {
  const { user } = useAuth();
  const { showError } = useToast();

  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setIsLoading(true);
      try {
        const data = await getVisits(user.username, user.role);
        setVisits(data);
      } catch {
        showError("Could not load analytics data.");
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  const monthlyData: BarChartDatum[] = useMemo(() => {
    return lastNMonths(MONTHS_TO_SHOW).map((m) => ({
      label: m.label,
      value: visits.filter((v) => (v.date || "").startsWith(m.key)).length,
    }));
  }, [visits]);

  const userData: BarChartDatum[] = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    visits.forEach((v) => {
      const key = (v.username || v.executive || "unknown").toLowerCase();
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { name: v.executive || v.username || "Unknown", count: 1 });
    });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_USERS_TO_SHOW)
      .map((u) => ({ label: u.name, value: u.count }));
  }, [visits]);

  const interestData: BarChartDatum[] = useMemo(() => {
    const counts = { Hot: 0, Warm: 0, Cold: 0 };
    visits.forEach((v) => {
      if (v.interest === "Hot" || v.interest === "Warm" || v.interest === "Cold") {
        counts[v.interest] += 1;
      }
    });
    return [
      { label: "Hot", value: counts.Hot, colorClass: "bg-red-500" },
      { label: "Warm", value: counts.Warm, colorClass: "bg-amber-500" },
      { label: "Cold", value: counts.Cold, colorClass: "bg-ink-400" },
    ];
  }, [visits]);

  return (
    <div className="min-h-screen pb-16">
      <TopBar title="Analytics" showBack />

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-5">
        {isLoading ? (
          <Loader label="Crunching the numbers..." />
        ) : (
          <>
            <Card>
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-amber-500" />
                <h2 className="font-display text-sm font-bold text-ink-900">
                  Visits by Month (last {MONTHS_TO_SHOW})
                </h2>
              </div>
              <BarChart data={monthlyData} />
            </Card>

            <Card>
              <div className="mb-4 flex items-center gap-2">
                <UsersIcon className="h-4 w-4 text-amber-500" />
                <h2 className="font-display text-sm font-bold text-ink-900">Visits by User</h2>
              </div>
              <BarChart data={userData} emptyLabel="No visits logged yet." />
            </Card>

            <Card>
              <div className="mb-4 flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-500" />
                <h2 className="font-display text-sm font-bold text-ink-900">Interest Distribution</h2>
              </div>
              <BarChart data={interestData} emptyLabel="No visits logged yet." />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute adminOnly>
      <AnalyticsContent />
    </ProtectedRoute>
  );
}
