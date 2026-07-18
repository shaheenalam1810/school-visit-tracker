"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Search as SearchIcon } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Select from "@/components/Select";
import Loader from "@/components/Loader";
import VisitCard from "@/components/VisitCard";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getDashboard } from "@/lib/api";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { UserRecord, VisitRecord } from "@/types";

// Only rendered once a visit is opened — loaded on demand instead of
// bundled into the initial visit-management chunk.
const VisitDetailsModal = dynamic(() => import("@/components/VisitDetailsModal"), {
  ssr: false,
});

const ALL = "all";
const PAGE_SIZE = 20;

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
  const [page, setPage] = useState(1);
  const [selectedVisit, setSelectedVisit] = useState<VisitRecord | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setIsLoading(true);
      try {
        // Single Apps Script call for both visits + users, instead of
        // two separate requests each re-authenticating the caller.
        const { visits: v, users: u } = await getDashboard(user.username, user.role);
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

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, usernameFilter, dateFilter, interestFilter]);

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
        if (debouncedSearch.trim()) {
          const q = debouncedSearch.trim().toLowerCase();
          const haystack = `${v.school_name} ${v.visitor} ${v.mobile} ${v.executive} ${v.username} ${v.interest} ${v.date}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  }, [visits, debouncedSearch, usernameFilter, dateFilter, interestFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredVisits.length / PAGE_SIZE));
  const pagedVisits = useMemo(
    () => filteredVisits.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredVisits, page]
  );

  return (
    <div className="min-h-screen pb-16">
      <TopBar title="Visit Management" showBack />

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-5">
        <Card className="flex flex-col gap-4">
          <Input
            label="Search"
            icon={<SearchIcon className="h-4 w-4" />}
            placeholder="School, visitor, mobile, executive, interest, date..."
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
          <>
            <div className="flex flex-col gap-3">
              {pagedVisits.map((v, idx) => (
                <VisitCard
                  key={v.visit_id || `${v.timestamp || idx}-${v.school_name}`}
                  visit={v}
                  onSelect={setSelectedVisit}
                  showExecutive
                />
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
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

export default function VisitManagementPage() {
  return (
    <ProtectedRoute adminOnly>
      <VisitManagementContent />
    </ProtectedRoute>
  );
}
