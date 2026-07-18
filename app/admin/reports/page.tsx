"use client";

import { useEffect, useMemo, useState } from "react";
import { FileDown, Printer } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Select from "@/components/Select";
import Button from "@/components/Button";
import Loader from "@/components/Loader";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getDashboard } from "@/lib/api";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { todayISO } from "@/lib/date";
import { UserRecord, VisitRecord } from "@/types";

const ALL = "all";

const INTEREST_OPTIONS = [
  { label: "All Interests", value: ALL },
  { label: "Hot", value: "Hot" },
  { label: "Warm", value: "Warm" },
  { label: "Cold", value: "Cold" },
];

const REPORT_HEADERS = [
  "Date",
  "Executive",
  "Username",
  "School",
  "Visitor",
  "Designation",
  "Mobile",
  "Address",
  "Students",
  "Teachers",
  "Current Software",
  "Interest",
  "Report",
  "Follow-up",
  "Notes",
  "Logged At",
];

function ReportsContent() {
  const { user } = useAuth();
  const { showError } = useToast();

  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [usernameFilter, setUsernameFilter] = useState(ALL);
  const [interestFilter, setInterestFilter] = useState(ALL);

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
      } catch {
        showError("Could not load report data.");
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
        if (dateFrom && (v.date || "") < dateFrom) return false;
        if (dateTo && (v.date || "") > dateTo) return false;
        if (usernameFilter !== ALL && v.username?.toLowerCase() !== usernameFilter.toLowerCase()) return false;
        if (interestFilter !== ALL && v.interest !== interestFilter) return false;
        return true;
      })
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }, [visits, dateFrom, dateTo, usernameFilter, interestFilter]);

  function handleExportCsv() {
    const rows = filteredVisits.map((v) => [
      v.date || "",
      v.executive || "",
      v.username || "",
      v.school_name || "",
      v.visitor || "",
      v.designation || "",
      v.mobile || "",
      v.address || "",
      v.students || "",
      v.teachers || "",
      v.current_software || "",
      v.interest || "",
      v.report || "",
      v.followup || "",
      v.notes || "",
      v.timestamp || "",
    ]);
    const csv = buildCsv(REPORT_HEADERS, rows);
    downloadCsv(`visit-report-${todayISO()}.csv`, csv);
  }

  function handlePrint() {
    window.print();
  }

  const rangeLabel =
    dateFrom || dateTo ? `${dateFrom || "start"} to ${dateTo || "today"}` : "All dates";

  return (
    <div className="min-h-screen pb-16">
      <div className="print:hidden">
        <TopBar title="Reports" showBack />
      </div>

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-5 print:max-w-none print:px-0 print:pt-0">
        <div className="print:hidden">
          <Card className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <Select
              label="Filter by user"
              options={userOptions}
              value={usernameFilter}
              onChange={(e) => setUsernameFilter(e.target.value)}
            />
            <Select
              label="Filter by interest"
              options={INTEREST_OPTIONS}
              value={interestFilter}
              onChange={(e) => setInterestFilter(e.target.value)}
            />
          </Card>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={handleExportCsv} disabled={isLoading || filteredVisits.length === 0}>
              <FileDown className="h-4 w-4" /> Export CSV
            </Button>
            <Button variant="ghost" onClick={handlePrint} disabled={isLoading || filteredVisits.length === 0}>
              <Printer className="h-4 w-4" /> Print / Save as PDF
            </Button>
          </div>
        </div>

        <div className="mt-2">
          <h1 className="font-display text-lg font-bold text-ink-900">School Visit Report</h1>
          <p className="text-xs font-body text-ink-500">
            {rangeLabel} &middot; Generated {todayISO()} &middot; {filteredVisits.length} visit
            {filteredVisits.length === 1 ? "" : "s"}
          </p>
        </div>

        {isLoading ? (
          <Loader label="Loading report..." />
        ) : filteredVisits.length === 0 ? (
          <Card className="text-center text-sm font-body text-ink-400">No visits match this report's filters.</Card>
        ) : (
          <div className="overflow-x-auto rounded-xl2 border border-ink-50 print:border-0">
            <table className="w-full min-w-[640px] text-left text-xs font-body">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50 print:bg-transparent">
                  <th className="px-3 py-2 font-semibold text-ink-600">Date</th>
                  <th className="px-3 py-2 font-semibold text-ink-600">Executive</th>
                  <th className="px-3 py-2 font-semibold text-ink-600">School</th>
                  <th className="px-3 py-2 font-semibold text-ink-600">Visitor</th>
                  <th className="px-3 py-2 font-semibold text-ink-600">Mobile</th>
                  <th className="px-3 py-2 font-semibold text-ink-600">Interest</th>
                  <th className="px-3 py-2 font-semibold text-ink-600">Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {filteredVisits.map((v, idx) => (
                  <tr key={`${v.timestamp || idx}-${v.school_name}`} className="border-b border-ink-50">
                    <td className="whitespace-nowrap px-3 py-2 text-ink-700">{v.date}</td>
                    <td className="px-3 py-2 text-ink-700">{v.executive}</td>
                    <td className="px-3 py-2 text-ink-900">{v.school_name}</td>
                    <td className="px-3 py-2 text-ink-700">{v.visitor}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-700">{v.mobile}</td>
                    <td className="px-3 py-2 text-ink-700">{v.interest}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-700">{v.followup || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute adminOnly>
      <ReportsContent />
    </ProtectedRoute>
  );
}
