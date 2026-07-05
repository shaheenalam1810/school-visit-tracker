"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  CalendarCheck2,
  ClipboardList,
  RefreshCw,
  School,
  MapPin,
  Flame,
  Sun,
  Snowflake,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Button from "@/components/Button";
import StatCard from "@/components/StatCard";
import Loader from "@/components/Loader";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getVisits } from "@/lib/api";
import { VisitRecord } from "@/types";

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

const interestBadge: Record<string, { icon: typeof Flame; classes: string }> = {
  Hot: { icon: Flame, classes: "bg-red-50 text-red-600" },
  Warm: { icon: Sun, classes: "bg-amber-50 text-amber-600" },
  Cold: { icon: Snowflake, classes: "bg-ink-50 text-ink-500" },
};

function DashboardContent() {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuth();
  const { showError } = useToast();
  const router = useRouter();

  async function loadVisits(silent = false) {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const data = await getVisits();
      setVisits(data);
    } catch (err) {
      showError("Could not load visits from Google Sheets.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadVisits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todayCount = useMemo(
    () => visits.filter((v) => v.date === todayISO()).length,
    [visits]
  );

  const myVisits = useMemo(
    () =>
      visits
        .filter((v) => v.executive?.toLowerCase() === user?.name.toLowerCase())
        .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || "")),
    [visits, user]
  );

  return (
    <div className="min-h-screen pb-28">
      <TopBar title="Dashboard" />

      <div className="mx-auto max-w-lg px-4 pt-5">
        {/* New Visit CTA */}
        <button
          onClick={() => router.push("/new-visit")}
          className="mb-5 flex w-full items-center justify-between rounded-xl2 bg-amber-500 px-5 py-5 text-left shadow-cardHover transition-transform active:scale-[0.98]"
        >
          <div>
            <p className="font-display text-lg font-bold text-ink-900">New Visit</p>
            <p className="text-sm font-body text-ink-800/70">Log a school visit now</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-900">
            <Plus className="h-6 w-6 text-white" />
          </div>
        </button>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <StatCard
            label="Today's Total Visits"
            value={isLoading ? "-" : todayCount}
            icon={<CalendarCheck2 className="h-6 w-6" />}
            accent="amber"
          />
          <StatCard
            label="My Submitted Visits"
            value={isLoading ? "-" : myVisits.length}
            icon={<ClipboardList className="h-6 w-6" />}
          />
        </div>

        {/* My submitted visits list */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-ink-900">My Submitted Visits</h2>
          <button
            onClick={() => loadVisits(true)}
            aria-label="Refresh"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-card active:scale-95"
          >
            <RefreshCw className={`h-4 w-4 text-ink-600 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {isLoading ? (
          <Loader label="Loading your visits..." />
        ) : myVisits.length === 0 ? (
          <Card className="text-center text-sm font-body text-ink-400">
            No visits yet. Tap &quot;New Visit&quot; to log your first school visit.
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {myVisits.map((v, idx) => {
              const badge = interestBadge[v.interest as string] || interestBadge.Warm;
              const Icon = badge.icon;
              return (
                <Card key={idx} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-700">
                        <School className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-display text-sm font-bold text-ink-900">
                          {v.school_name}
                        </p>
                        <p className="text-xs font-body text-ink-400">{v.date}</p>
                      </div>
                    </div>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.classes}`}
                    >
                      <Icon className="h-3 w-3" />
                      {v.interest}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-body text-ink-500">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{v.address}</span>
                  </div>
                  {v.notes && (
                    <p className="line-clamp-2 text-xs font-body text-ink-400">{v.notes}</p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
