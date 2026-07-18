"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Phone,
  MapPinned,
  MessageCircle,
  Mail,
  Video,
  Flag,
} from "lucide-react";
import Button from "./Button";
import Input from "./Input";
import Select from "./Select";
import Textarea from "./Textarea";
import ConfirmDialog from "./ConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { addFollowUp, deleteFollowUp, getFollowUps, updateFollowUp } from "@/lib/api";
import { todayISO } from "@/lib/date";
import { FollowUpRecord, FollowUpStatus, FollowUpType, VisitRecord } from "@/types";

interface FollowUpTimelineProps {
  visit: VisitRecord;
}

// Exported so other follow-up UIs (e.g. the Daily Follow-up Dashboard's
// edit modal) reuse the exact same option lists/icons instead of a
// second, driftable copy.
export const TYPE_OPTIONS: { label: string; value: FollowUpType }[] = [
  { label: "Phone Call", value: "Phone Call" },
  { label: "Physical Visit", value: "Physical Visit" },
  { label: "WhatsApp", value: "WhatsApp" },
  { label: "Email", value: "Email" },
  { label: "Online Meeting", value: "Online Meeting" },
];

export const STATUS_OPTIONS: { label: string; value: FollowUpStatus }[] = [
  { label: "Pending", value: "Pending" },
  { label: "Completed", value: "Completed" },
  { label: "Interested", value: "Interested" },
  { label: "Not Interested", value: "Not Interested" },
  { label: "No Response", value: "No Response" },
  { label: "Cancelled", value: "Cancelled" },
];

export const TYPE_ICON: Record<string, typeof Phone> = {
  "Phone Call": Phone,
  "Physical Visit": MapPinned,
  WhatsApp: MessageCircle,
  Email: Mail,
  "Online Meeting": Video,
};

const STATUS_CLASSES: Record<string, string> = {
  Pending: "bg-orange-50 text-orange-600",
  Completed: "bg-emerald-50 text-emerald-600",
  Interested: "bg-red-50 text-red-600",
  "Not Interested": "bg-ink-50 text-ink-500",
  "No Response": "bg-purple-50 text-purple-600",
  Cancelled: "bg-ink-50 text-ink-500",
};

const DOT_CLASSES: Record<string, string> = {
  Pending: "bg-orange-500",
  Completed: "bg-emerald-500",
  Interested: "bg-red-500",
  "Not Interested": "bg-ink-400",
  "No Response": "bg-purple-500",
  Cancelled: "bg-ink-400",
};

type FollowUpForm = {
  followup_date: string;
  next_followup_date: string;
  type: FollowUpType | "";
  status: FollowUpStatus | "";
  notes: string;
};

const EMPTY_FORM: FollowUpForm = {
  followup_date: todayISO(),
  next_followup_date: "",
  type: "",
  status: "",
  notes: "",
};

function formatDate(value?: string): string {
  if (!value) return "—";
  return value;
}

function TimelineRow({ dotClass, isLast, children }: { dotClass: string; isLast?: boolean; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${dotClass}`} />
        {!isLast && <span className="w-px flex-1 bg-ink-100" />}
      </div>
      <div className="flex-1 pb-4">{children}</div>
    </div>
  );
}

export default function FollowUpTimeline({ visit }: FollowUpTimelineProps) {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formTarget, setFormTarget] = useState<"new" | string | null>(null);
  const [form, setForm] = useState<FollowUpForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FollowUpRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user || !visit.visit_id) return;
    (async () => {
      setIsLoading(true);
      try {
        const data = await getFollowUps(visit.visit_id as string, user.username);
        setFollowUps(data);
      } catch {
        showError("Could not load follow-up history.");
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit.visit_id, user?.username]);

  const canAdd =
    !!user &&
    (user.role === "admin" || (visit.username || "").trim().toLowerCase() === user.username.trim().toLowerCase());

  function canManageEntry(entry: FollowUpRecord): boolean {
    if (!user) return false;
    return user.role === "admin" || (entry.created_by || "").trim().toLowerCase() === user.username.trim().toLowerCase();
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setFormTarget("new");
  }

  function openEdit(entry: FollowUpRecord) {
    setForm({
      followup_date: entry.followup_date || todayISO(),
      next_followup_date: entry.next_followup_date || "",
      type: entry.type || "",
      status: entry.status || "",
      notes: entry.notes || "",
    });
    setFormTarget(entry.followup_id);
  }

  function closeForm() {
    setFormTarget(null);
    setForm(EMPTY_FORM);
  }

  function update<K extends keyof FollowUpForm>(key: K, value: FollowUpForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !visit.visit_id || !formTarget) return;
    if (!form.followup_date || !form.type || !form.status) {
      showError("Follow-up date, type, and status are required.");
      return;
    }

    setIsSaving(true);
    try {
      if (formTarget === "new") {
        const res = await addFollowUp({ requestedBy: user.username, visit_id: visit.visit_id, ...form });
        if (res.success) {
          showSuccess("Follow-up added.");
          if (res.data) setFollowUps((prev) => [...prev, res.data as FollowUpRecord]);
          closeForm();
        } else {
          showError(res.message || "Could not add follow-up.");
        }
      } else {
        const res = await updateFollowUp({ requestedBy: user.username, followup_id: formTarget, ...form });
        if (res.success) {
          showSuccess("Follow-up updated.");
          setFollowUps((prev) =>
            prev.map((f) => (f.followup_id === formTarget ? { ...f, ...form, updated_by: user.username } : f))
          );
          closeForm();
        } else {
          showError(res.message || "Could not update follow-up.");
        }
      }
    } catch {
      showError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!user || !deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteFollowUp({ requestedBy: user.username, followup_id: deleteTarget.followup_id });
      if (res.success) {
        showSuccess("Follow-up deleted.");
        setFollowUps((prev) => prev.filter((f) => f.followup_id !== deleteTarget.followup_id));
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

  const sorted = [...followUps].sort((a, b) => (a.followup_date || "").localeCompare(b.followup_date || ""));

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Flag className="h-3.5 w-3.5 text-ink-400" />
        <h4 className="font-display text-xs font-bold uppercase tracking-wide text-ink-500">Follow-up Timeline</h4>
      </div>

      {canAdd && formTarget === null && (
        <Button variant="secondary" className="mb-4" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Follow-up
        </Button>
      )}

      {formTarget !== null && (
        <form onSubmit={handleSubmit} className="mb-4 flex flex-col gap-3 rounded-xl2 border border-ink-100 bg-ink-50/40 p-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Follow-up Date"
              type="date"
              value={form.followup_date}
              onChange={(e) => update("followup_date", e.target.value)}
              required
            />
            <Input
              label="Next Follow-up Date"
              type="date"
              value={form.next_followup_date}
              onChange={(e) => update("next_followup_date", e.target.value)}
            />
          </div>
          <Select
            label="Follow-up Type"
            options={TYPE_OPTIONS}
            value={form.type}
            onChange={(e) => update("type", e.target.value as FollowUpType)}
          />
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={(e) => update("status", e.target.value as FollowUpStatus)}
          />
          <Textarea
            label="Discussion Note"
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={2}
          />
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={closeForm} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {formTarget === "new" ? "Add Follow-up" : "Save Changes"}
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm font-body text-ink-400">Loading follow-up history...</p>
      ) : (
        <div className="flex flex-col">
          <TimelineRow dotClass="bg-ink-800" isLast={sorted.length === 0}>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Visit Created</p>
            <p className="text-sm font-body text-ink-900">
              {visit.date} by {visit.created_by || visit.username || visit.executive}
            </p>
          </TimelineRow>

          {sorted.map((entry, idx) => {
            const TypeIcon = TYPE_ICON[entry.type as string] || Phone;
            const statusClasses = STATUS_CLASSES[entry.status as string] || "bg-ink-50 text-ink-500";
            const dotClass = DOT_CLASSES[entry.status as string] || "bg-ink-400";
            return (
              <TimelineRow key={entry.followup_id} dotClass={dotClass} isLast={idx === sorted.length - 1}>
                <div className="rounded-xl2 border border-ink-50 bg-white p-3 shadow-card">
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-sm font-body font-semibold text-ink-900">
                      <TypeIcon className="h-3.5 w-3.5 text-ink-500" />
                      {entry.type}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses}`}>
                      {entry.status}
                    </span>
                  </div>
                  <p className="text-xs font-body text-ink-500">
                    {formatDate(entry.followup_date)}
                    {entry.next_followup_date && (
                      <>
                        {" "}
                        &middot; Next: <span className="font-semibold text-ink-700">{entry.next_followup_date}</span>
                      </>
                    )}
                  </p>
                  {entry.notes && <p className="mt-1.5 text-xs font-body text-ink-600">{entry.notes}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[11px] font-body text-ink-400">By {entry.created_by}</p>
                    {canManageEntry(entry) && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(entry)}
                          aria-label="Edit follow-up"
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-50 text-ink-600 active:scale-90"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(entry)}
                          aria-label="Delete follow-up"
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-600 active:scale-90"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </TimelineRow>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this follow-up?"
          message="This follow-up entry will be removed from the timeline. This cannot be undone."
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
