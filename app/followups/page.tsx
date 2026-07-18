"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Bell, Search as SearchIcon } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Loader from "@/components/Loader";
import FollowUpDashboardCard from "@/components/FollowUpDashboardCard";
import Pagination from "@/components/Pagination";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { deleteFollowUp, getFollowUpDashboard, updateFollowUp } from "@/lib/api";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { addDaysISO } from "@/lib/date";
import { computeBucketClient, groupFollowUpsByDate } from "@/lib/followup";
import { FollowUpDashboardRecord, VisitRecord } from "@/types";

// Both are only needed once a card action is used — loaded on demand
// instead of bundled into the initial /followups chunk.
const VisitDetailsModal = dynamic(() => import("@/components/VisitDetailsModal"), { ssr: false });
const FollowUpEditModal = dynamic(() => import("@/components/FollowUpEditModal"), { ssr: false });

type QuickFilter = "today" | "tomorrow" | "thisWeek" | "overdue" | "upcoming" | "completed" | "all";

const QUICK_FILTERS: { label: string; value: QuickFilter }[] = [
  { label: "Today", value: "today" },
  { label: "Tomorrow", value: "tomorrow" },
  { label: "This Week", value: "thisWeek" },
  { label: "Overdue", value: "overdue" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Completed", value: "completed" },
  { label: "All", value: "all" },
];

const VALID_FILTERS = new Set(QUICK_FILTERS.map((f) => f.value));
const PAGE_SIZE = 20;

function FollowUpsContent() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const searchParams = useSearchParams();

  const [followups, setFollowups] = useState<FollowUpDashboardRecord[]>([]);
  const [serverToday, setServerToday] = useState("");
  const [serverTomorrow, setServerTomorrow] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const initialFilter = searchParams.get("filter") || "today";
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(
    VALID_FILTERS.has(initialFilter as QuickFilter) ? (initialFilter as QuickFilter) : "today"
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [selectedVisit, setSelectedVisit] = useState<VisitRecord | null>(null);
  const [editingItem, setEditingItem] = useState<FollowUpDashboardRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FollowUpDashboardRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setIsLoading(true);
      try {
        const data = await getFollowUpDashboard(user.username, user.role);
        setFollowups(data.followups);
        setServerToday(data.today);
        setServerTomorrow(data.tomorrow);
      } catch {
        showError("Could not load the follow-up dashboard.");
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  useEffect(() => {
    setPage(1);
  }, [quickFilter, startDate, endDate, debouncedSearch]);

  const liveCounts = useMemo(() => {
    const counts = { today: 0, overdue: 0 };
    followups.forEach((f) => {
      if (f.bucket === "today") counts.today += 1;
      if (f.bucket === "overdue") counts.overdue += 1;
    });
    return counts;
  }, [followups]);

  const filtered = useMemo(() => {
    const weekEnd = serverToday ? addDaysISO(serverToday, 6) : "";
    return followups.filter((item) => {
      if (quickFilter === "thisWeek") {
        const next = item.next_followup_date || "";
        if (!next || next < serverToday || next > weekEnd) return false;
      } else if (quickFilter !== "all") {
        if (item.bucket !== quickFilter) return false;
      }

      if (startDate && (item.next_followup_date || "") < startDate) return false;
      if (endDate && (item.next_followup_date || "") > endDate) return false;

      if (debouncedSearch.trim()) {
        const q = debouncedSearch.trim().toLowerCase();
        const haystack = `${item.visit.school_name} ${item.visit.visitor} ${item.visit.mobile} ${item.visit.executive} ${item.visit.username} ${item.notes || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [followups, quickFilter, startDate, endDate, debouncedSearch, serverToday]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const groups = useMemo(
    () => groupFollowUpsByDate(pageItems, serverToday, serverTomorrow),
    [pageItems, serverToday, serverTomorrow]
  );

  function canManage(item: FollowUpDashboardRecord): boolean {
    if (!user) return false;
    return user.role === "admin" || (item.created_by || "").trim().toLowerCase() === user.username.trim().toLowerCase();
  }

  function patchFollowUp(followupId: string, patch: Partial<FollowUpDashboardRecord>) {
    setFollowups((prev) =>
      prev.map((f) => {
        if (f.followup_id !== followupId) return f;
        const merged = { ...f, ...patch };
        const bucket = computeBucketClient(merged.status || "", merged.next_followup_date, serverToday, serverTomorrow);
        return { ...merged, bucket };
      })
    );
  }

  async function handleMarkCompleted(item: FollowUpDashboardRecord) {
    if (!user) return;
    setCompletingId(item.followup_id);
    try {
      const res = await updateFollowUp({
        requestedBy: user.username,
        followup_id: item.followup_id,
        status: "Completed",
      });
      if (res.success) {
        showSuccess("Follow-up marked as completed.");
        patchFollowUp(item.followup_id, { status: "Completed" });
      } else {
        showError(res.message || "Could not update follow-up.");
      }
    } catch {
      showError("Network error. Please try again.");
    } finally {
      setCompletingId(null);
    }
  }

  async function handleDelete() {
    if (!user || !deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteFollowUp({ requestedBy: user.username, followup_id: deleteTarget.followup_id });
      if (res.success) {
        showSuccess("Follow-up deleted.");
        setFollowups((prev) => prev.filter((f) => f.followup_id !== deleteTarget.followup_id));
        setDeleteTarget(null);
      } else {
        showError(res.message || "Could not delete follow-up.");
      }
    } catch {
      showError("Network error. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="min-h-screen pb-16">
      <TopBar title="Follow-ups" showBack />

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-5">
        {!isLoading && (liveCounts.today > 0 || liveCounts.overdue > 0) && (
          <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50/60 px-4 py-3 text-sm font-semibold text-red-700">
            <Bell className="h-4 w-4 flex-shrink-0" />
            <span>
              {liveCounts.today > 0 && `Today's Follow-ups (${liveCounts.today})`}
              {liveCounts.today > 0 && liveCounts.overdue > 0 && " · "}
              {liveCounts.overdue > 0 && `Overdue (${liveCounts.overdue})`}
            </span>
          </div>
        )}

        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex gap-2">
            {QUICK_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setQuickFilter(f.value)}
                className={`flex-shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition active:scale-95 ${
                  quickFilter === f.value ? "bg-ink-800 text-white" : "bg-white text-ink-600 shadow-card"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <Card className="flex flex-col gap-4">
          <Input
            label="Search"
            icon={<SearchIcon className="h-4 w-4" />}
            placeholder="School, visitor, mobile, executive, username, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </Card>

        <p className="text-xs font-body text-ink-400">
          {isLoading ? "Loading..." : `${filtered.length} follow-up${filtered.length === 1 ? "" : "s"} found`}
        </p>

        {isLoading ? (
          <Loader label="Loading follow-ups..." />
        ) : filtered.length === 0 ? (
          <Card className="text-center text-sm font-body text-ink-400">
            {followups.length === 0
              ? "No follow-ups have been logged yet."
              : "No follow-ups match your filters."}
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-5">
              {groups.map((group) => (
                <div key={group.label}>
                  <h2 className="mb-2.5 font-display text-sm font-bold text-ink-900">{group.label}</h2>
                  <div className="flex flex-col gap-3">
                    {group.items.map((item) => (
                      <FollowUpDashboardCard
                        key={item.followup_id}
                        item={item}
                        canManage={canManage(item)}
                        onOpenVisit={(i) => setSelectedVisit(i.visit)}
                        onEdit={(i) => setEditingItem(i)}
                        onMarkCompleted={handleMarkCompleted}
                        onDelete={(i) => setDeleteTarget(i)}
                        isCompleting={completingId === item.followup_id}
                      />
                    ))}
                  </div>
                </div>
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
            setFollowups((prev) => prev.map((f) => (f.visit_id === updated.visit_id ? { ...f, visit: updated } : f)));
            setSelectedVisit(updated);
          }}
          onDeleted={(visitId) => {
            setFollowups((prev) => prev.filter((f) => f.visit_id !== visitId));
            setSelectedVisit(null);
          }}
        />
      )}

      {editingItem && (
        <FollowUpEditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={(followupId, updates) => patchFollowUp(followupId, updates)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this follow-up?"
          message={`This follow-up entry for "${deleteTarget.visit.school_name}" will be removed. This cannot be undone.`}
          confirmLabel="Delete"
          tone="danger"
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default function FollowUpsPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<Loader label="Loading follow-ups..." />}>
        <FollowUpsContent />
      </Suspense>
    </ProtectedRoute>
  );
}
