"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search as SearchIcon,
  LogIn,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  UserPlus,
  UserCog,
  Power,
  Activity as ActivityIcon,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Skeleton from "@/components/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getActivityLog } from "@/lib/api";
import { ActivityLogRecord } from "@/types";

const ACTION_ICONS: Record<string, typeof ActivityIcon> = {
  "logged in": LogIn,
  "logged out": LogOut,
  "created a visit": Plus,
  "edited a visit": Pencil,
  "deleted a visit": Trash2,
  "created a user": UserPlus,
  "edited a user": UserCog,
  "disabled a user": Power,
  "enabled a user": Power,
  "deleted a user": Trash2,
  "changed a password": KeyRound,
};

function iconFor(action: string) {
  return ACTION_ICONS[action] || ActivityIcon;
}

function formatDateTime(record: ActivityLogRecord): string {
  if (record.date && record.time) return `${record.date} ${record.time}`;
  if (record.timestamp) return new Date(record.timestamp).toLocaleString();
  return "—";
}

function ActivityLogContent() {
  const { user } = useAuth();
  const { showError } = useToast();

  const [logs, setLogs] = useState<ActivityLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setIsLoading(true);
      try {
        const data = await getActivityLog(user.username);
        setLogs(data);
      } catch {
        showError("Could not load the activity log.");
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  const filtered = useMemo(() => {
    return logs
      .filter((l) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        const haystack = `${l.username} ${l.action} ${l.details || ""}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  }, [logs, search]);

  return (
    <div className="min-h-screen pb-16">
      <TopBar title="Activity Log" showBack />

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-5">
        <Card>
          <Input
            label="Search"
            icon={<SearchIcon className="h-4 w-4" />}
            placeholder="Username, action, details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Card>

        <p className="text-xs font-body text-ink-400">
          {isLoading ? "Loading..." : `${filtered.length} ${filtered.length === 1 ? "entry" : "entries"}`}
        </p>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Card key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 flex-shrink-0" />
                <div className="flex-1">
                  <Skeleton className="mb-2 h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="text-center text-sm font-body text-ink-400">
            {logs.length === 0 ? "No activity has been recorded yet." : "No activity matches your search."}
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((l, idx) => {
              const Icon = iconFor(l.action);
              return (
                <Card key={`${l.timestamp || idx}-${l.username}`} className="flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-700">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-body text-ink-900">
                      <span className="font-display font-bold">{l.username || "Unknown"}</span> {l.action}
                    </p>
                    {l.details && (
                      <p className="mt-0.5 truncate text-xs font-body text-ink-500">{l.details}</p>
                    )}
                    <p className="mt-1 text-[11px] font-body text-ink-400">
                      {formatDateTime(l)} &middot; IP: {l.ip || "N/A"}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ActivityLogPage() {
  return (
    <ProtectedRoute adminOnly>
      <ActivityLogContent />
    </ProtectedRoute>
  );
}
