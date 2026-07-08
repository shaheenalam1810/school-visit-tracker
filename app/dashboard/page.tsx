"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  RefreshCw,
  School,
  MapPin,
  Flame,
  Sun,
  Snowflake,
  Search as SearchIcon,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Input from "@/components/Input";
import StatCard from "@/components/StatCard";
import Loader from "@/components/Loader";
import VisitDetailsModal from "@/components/VisitDetailsModal";
import FollowUpSection from "@/components/FollowUpSection";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getVisits } from "@/lib/api";
import { todayISO, currentMonthPrefix, isWithinLastDays } from "@/lib/date";
import { VisitRecord } from "@/types";

const interestBadge: Record<string, { icon: typeof Flame; classes: string }> = {
  Hot: { icon: Flame, classes: "bg-red-50 text-red-600" },
  Warm: { icon: Sun, classes: "bg-amber-50 text-amber-600" },
  Cold: { icon: Snowflake, classes: "bg-ink-50 text-ink-500" },
};

function DashboardContent() {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedVisit, setSelectedVisit] = useState<VisitRecord | null>(null);
  const { user } = useAuth();
  const { showError } = useToast();
  const router = useRouter();

  async function loadVisits(silent = false) {
    if (!user) return;
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      // The Apps Script backend already scopes this to the caller's own
      // visits for non-admins, so no further client-side filtering by
      // identity is needed (or safe to rely on for security).
      const data = await getVisits(user.username, user.role);
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
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
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

        {!isLoading && <FollowUpSection visits={visits} onSelectVisit={setSelectedVisit} />}

        {/* Search + date filter */}
        <Card className="mb-5 flex flex-col gap-4">
          <Input
            label="Search"
            icon={<SearchIcon className="h-4 w-4" />}
            placeholder="School, visitor, mobile, interest, date..."
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

        {/* My visit history */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-ink-900">My Visit History</h2>
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
        ) : filteredVisits.length === 0 ? (
          <Card className="text-center text-sm font-body text-ink-400">
            {visits.length === 0
              ? 'No visits yet. Tap "New Visit" to log your first school visit.'
              : "No visits match your search or date filter."}
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredVisits.map((v, idx) => {
              const badge = interestBadge[v.interest as string] || null;
              const Icon = badge?.icon;
              return (
                <Card
                  key={`${v.timestamp || idx}-${v.school_name}`}
                  className="flex cursor-pointer flex-col gap-2 transition active:scale-[0.99]"
                  onClick={() => setSelectedVisit(v)}
                >
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
                    {badge && Icon && (
                      <span
                        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.classes}`}
                      >
                        <Icon className="h-3 w-3" />
                        {v.interest}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-body text-ink-500">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{v.address}</span>
                  </div>
                  {v.google_map && (
                    <a
                      href={v.google_map}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="w-fit text-xs font-body text-blue-600 underline"
                    >
                      View on Google Maps
                    </a>
                  )}
                  {v.notes && (
                    <p className="line-clamp-2 text-xs font-body text-ink-400">{v.notes}</p>
                  )}
                </Card>
              );
            })}
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

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
