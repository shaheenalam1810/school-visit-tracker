"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users as UsersIcon,
  UserCheck,
  UserX,
  ClipboardList,
  CalendarCheck2,
  CalendarRange,
  CalendarDays,
  Flame,
  Sun,
  Snowflake,
  Search as SearchIcon,
  Trophy,
  Settings,
  ListChecks,
  History,
  BarChart3,
  FileDown,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Button from "@/components/Button";
import StatCard from "@/components/StatCard";
import Loader from "@/components/Loader";
import VisitDetailsModal from "@/components/VisitDetailsModal";
import FollowUpSection from "@/components/FollowUpSection";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getUsers, getVisits } from "@/lib/api";
import { todayISO, currentMonthPrefix, isWithinLastDays } from "@/lib/date";
import { UserRecord, VisitRecord } from "@/types";

type RankPeriod = "today" | "week" | "month" | "total";

const RANK_TABS: { label: string; value: RankPeriod }[] = [
  { label: "Today", value: "today" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Total", value: "total" },
];

function AdminDashboardContent() {
  const { user } = useAuth();
  const { showError } = useToast();
  const router = useRouter();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedVisit, setSelectedVisit] = useState<VisitRecord | null>(null);
  const [rankPeriod, setRankPeriod] = useState<RankPeriod>("total");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setIsLoading(true);
      try {
        const [u, v] = await Promise.all([
          getUsers(user.username),
          getVisits(user.username, user.role),
        ]);
        setUsers(u);
        setVisits(v);
      } catch (err) {
        showError("Could not load admin data.");
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  const todayCount = useMemo(
    () => visits.filter((v) => v.date === todayISO()).length,
    [visits]
  );

  const weeklyCount = useMemo(
    () => visits.filter((v) => isWithinLastDays(v.date, 7)).length,
    [visits]
  );

  const monthlyCount = useMemo(
    () => visits.filter((v) => (v.date || "").startsWith(currentMonthPrefix())).length,
    [visits]
  );

  const activeUsers = useMemo(() => users.filter((u) => u.status === "active").length, [users]);
  const inactiveUsers = useMemo(() => users.filter((u) => u.status === "disabled").length, [users]);

  const interestCounts = useMemo(() => {
    const counts = { Hot: 0, Warm: 0, Cold: 0 };
    visits.forEach((v) => {
      if (v.interest === "Hot" || v.interest === "Warm" || v.interest === "Cold") {
        counts[v.interest] += 1;
      }
    });
    return counts;
  }, [visits]);

  const rankPeriodVisits = useMemo(() => {
    if (rankPeriod === "today") return visits.filter((v) => v.date === todayISO());
    if (rankPeriod === "week") return visits.filter((v) => isWithinLastDays(v.date, 7));
    if (rankPeriod === "month") return visits.filter((v) => (v.date || "").startsWith(currentMonthPrefix()));
    return visits;
  }, [visits, rankPeriod]);

  const ranking = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    rankPeriodVisits.forEach((v) => {
      const key = (v.username || v.executive || "unknown").toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { name: v.executive || v.username || "Unknown", count: 1 });
      }
    });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [rankPeriodVisits]);

  const filteredVisits = useMemo(() => {
    return visits
      .filter((v) => {
        if (dateFilter && v.date !== dateFilter) return false;
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const haystack = `${v.school_name} ${v.visitor} ${v.mobile} ${v.executive} ${v.username} ${v.interest} ${v.date}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  }, [visits, search, dateFilter]);

  return (
    <div className="min-h-screen pb-28">
      <TopBar title="Admin Dashboard" />

      <div className="mx-auto max-w-lg px-4 pt-5">
        {/* Quick nav */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => router.push("/admin/users")}>
            <Settings className="h-4 w-4" /> Manage Users
          </Button>
          <Button variant="ghost" onClick={() => router.push("/admin/visits")}>
            <ListChecks className="h-4 w-4" /> Manage Visits
          </Button>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Button variant="ghost" onClick={() => router.push("/admin/analytics")}>
            <BarChart3 className="h-4 w-4" /> Analytics
          </Button>
          <Button variant="ghost" onClick={() => router.push("/admin/reports")}>
            <FileDown className="h-4 w-4" /> Reports
          </Button>
        </div>
        <div className="mb-5">
          <Button variant="ghost" onClick={() => router.push("/admin/activity")}>
            <History className="h-4 w-4" /> Activity Log
          </Button>
        </div>

        {/* People stats */}
        <div className="mb-3 grid grid-cols-3 gap-3">
          <StatCard
            label="Total Users"
            value={isLoading ? "-" : users.length}
            icon={<UsersIcon className="h-5 w-5" />}
            accent="amber"
          />
          <StatCard
            label="Active"
            value={isLoading ? "-" : activeUsers}
            icon={<UserCheck className="h-5 w-5" />}
          />
          <StatCard
            label="Inactive"
            value={isLoading ? "-" : inactiveUsers}
            icon={<UserX className="h-5 w-5" />}
          />
        </div>

        {/* Visit stats */}
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Today's Visits"
            value={isLoading ? "-" : todayCount}
            icon={<CalendarCheck2 className="h-6 w-6" />}
            accent="amber"
          />
          <StatCard
            label="Weekly Visits"
            value={isLoading ? "-" : weeklyCount}
            icon={<CalendarRange className="h-6 w-6" />}
          />
          <StatCard
            label="Monthly Visits"
            value={isLoading ? "-" : monthlyCount}
            icon={<CalendarDays className="h-6 w-6" />}
          />
          <StatCard
            label="Total Visits"
            value={isLoading ? "-" : visits.length}
            icon={<ClipboardList className="h-6 w-6" />}
          />
        </div>

        {/* Interest breakdown */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <StatCard label="Hot" value={isLoading ? "-" : interestCounts.Hot} icon={<Flame className="h-5 w-5" />} />
          <StatCard
            label="Warm"
            value={isLoading ? "-" : interestCounts.Warm}
            icon={<Sun className="h-5 w-5" />}
            accent="amber"
          />
          <StatCard label="Cold" value={isLoading ? "-" : interestCounts.Cold} icon={<Snowflake className="h-5 w-5" />} />
        </div>

        {/* Top performer */}
        <Card className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h2 className="font-display text-sm font-bold text-ink-900">Top Performer</h2>
            </div>
          </div>
          <div className="mb-3 grid grid-cols-4 gap-1.5">
            {RANK_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setRankPeriod(tab.value)}
                className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                  rankPeriod === tab.value ? "bg-ink-800 text-white" : "bg-ink-50 text-ink-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {isLoading ? (
            <Loader label="Loading ranking..." />
          ) : ranking.length === 0 ? (
            <p className="text-sm font-body text-ink-400">No visits logged for this period.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {ranking.map((r, i) => (
                <div key={`${r.name}-${i}`} className="flex items-center justify-between text-sm font-body">
                  <span className="flex items-center gap-2 text-ink-700">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-ink-50 text-xs font-bold text-ink-700">
                      {i + 1}
                    </span>
                    {r.name}
                  </span>
                  <span className="font-semibold text-ink-900">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {!isLoading && <FollowUpSection visits={visits} onSelectVisit={setSelectedVisit} />}

        {/* Search + date filter */}
        <Card className="mb-5 flex flex-col gap-4">
          <Input
            label="Search"
            icon={<SearchIcon className="h-4 w-4" />}
            placeholder="School, visitor, mobile, executive, interest, date..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Input
            label="Filter by date"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </Card>

        <h2 className="mb-3 font-display text-base font-bold text-ink-900">
          Recent Visits {isLoading ? "" : `(${filteredVisits.length})`}
        </h2>

        {isLoading ? (
          <Loader label="Loading visits..." />
        ) : filteredVisits.length === 0 ? (
          <Card className="text-center text-sm font-body text-ink-400">No visits match your filters.</Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredVisits.slice(0, 25).map((v, idx) => (
              <Card
                key={`${v.timestamp || idx}-${v.school_name}`}
                className="flex cursor-pointer flex-col gap-1.5 transition active:scale-[0.99]"
                onClick={() => setSelectedVisit(v)}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-display text-sm font-bold text-ink-900">{v.school_name}</p>
                  <span className="flex-shrink-0 text-xs font-body text-ink-400">{v.date}</span>
                </div>
                <p className="text-xs font-body text-ink-500">
                  {v.executive} &middot; {v.interest || "-"}
                </p>
              </Card>
            ))}
            {filteredVisits.length > 25 && (
              <p className="text-center text-xs font-body text-ink-400">
                Showing 25 of {filteredVisits.length}. Open Manage Visits to see all.
              </p>
            )}
          </div>
        )}
      </div>

      {selectedVisit && (
        <VisitDetailsModal
          visit={selectedVisit}
          onClose={() => setSelectedVisit(null)}
          onUpdated={(updated) => {
            setVisits((prev) =>
              prev.map((v) => (v.visit_id === updated.visit_id ? updated : v))
            );
            setSelectedVisit(updated);
          }}
          onDeleted={(visitId) => {
            setVisits((prev) => prev.filter((v) => v.visit_id !== visitId));
            setSelectedVisit(null);
          }}
        />
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute adminOnly>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}
