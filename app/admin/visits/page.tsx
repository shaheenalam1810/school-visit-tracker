"use client";

import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon, School, MapPin, Flame, Sun, Snowflake } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Select from "@/components/Select";
import Loader from "@/components/Loader";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getUsers, getVisits } from "@/lib/api";
import { UserRecord, VisitRecord } from "@/types";

const ALL = "all";

const interestBadge: Record<string, { icon: typeof Flame; classes: string }> = {
  Hot: { icon: Flame, classes: "bg-red-50 text-red-600" },
  Warm: { icon: Sun, classes: "bg-amber-50 text-amber-600" },
  Cold: { icon: Snowflake, classes: "bg-ink-50 text-ink-500" },
};

const INTEREST_OPTIONS = [
  { label: "All Interests", value: ALL },
  { label: "Hot", value: "Hot" },
  { label: "Warm", value: "Warm" },
  { label: "Cold", value: "Cold" },
];

function VisitManagementContent() {
  const { user } = useAuth();
  const { showError } = useToast();

  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [usernameFilter, setUsernameFilter] = useState(ALL);
  const [dateFilter, setDateFilter] = useState("");
  const [interestFilter, setInterestFilter] = useState(ALL);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setIsLoading(true);
      try {
        const [v, u] = await Promise.all([getVisits(user.username, user.role), getUsers(user.username)]);
        setVisits(v);
        setUsers(u);
      } catch (err) {
        showError("Could not load visits.");
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  const userOptions = useMemo(
    () => [
      { label: "All Users", value: ALL },
      ...users.map((u) => ({ label: `${u.name} (@${u.username})`, value: u.username })),
    ],
    [users]
  );

  const filteredVisits = useMemo(() => {
    return visits
      .filter((v) => {
        if (usernameFilter !== ALL && v.username?.toLowerCase() !== usernameFilter.toLowerCase()) return false;
        if (dateFilter && v.date !== dateFilter) return false;
        if (interestFilter !== ALL && v.interest !== interestFilter) return false;
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const haystack = `${v.school_name} ${v.visitor} ${v.executive}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  }, [visits, search, usernameFilter, dateFilter, interestFilter]);

  return (
    <div className="min-h-screen pb-16">
      <TopBar title="Visit Management" showBack />

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-5">
        <Card className="flex flex-col gap-4">
          <Input
            label="Search"
            icon={<SearchIcon className="h-4 w-4" />}
            placeholder="School, visitor, executive..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="Filter by user"
            options={userOptions}
            value={usernameFilter}
            onChange={(e) => setUsernameFilter(e.target.value)}
          />
          <Input
            label="Filter by date"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          <Select
            label="Filter by interest"
            options={INTEREST_OPTIONS}
            value={interestFilter}
            onChange={(e) => setInterestFilter(e.target.value)}
          />
        </Card>

        <p className="text-xs font-body text-ink-400">
          {isLoading ? "Loading..." : `${filteredVisits.length} visit${filteredVisits.length === 1 ? "" : "s"} found`}
        </p>

        {isLoading ? (
          <Loader label="Loading visits..." />
        ) : filteredVisits.length === 0 ? (
          <Card className="text-center text-sm font-body text-ink-400">No visits match your filters.</Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredVisits.map((v, idx) => {
              const badge = interestBadge[v.interest as string] || null;
              const Icon = badge?.icon;
              return (
                <Card key={`${v.timestamp || idx}-${v.school_name}`} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-700">
                        <School className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-display text-sm font-bold text-ink-900">{v.school_name}</p>
                        <p className="text-xs font-body text-ink-400">
                          {v.date} &middot; {v.executive}
                        </p>
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
                      className="w-fit text-xs font-body text-blue-600 underline"
                    >
                      View on Google Maps
                    </a>
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

export default function VisitManagementPage() {
  return (
    <ProtectedRoute adminOnly>
      <VisitManagementContent />
    </ProtectedRoute>
  );
}
