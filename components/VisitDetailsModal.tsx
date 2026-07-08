"use client";

import { ReactNode, useState } from "react";
import {
  Pencil,
  Trash2,
  MapPin,
  Flame,
  Sun,
  Snowflake,
  Clock,
} from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";
import Input from "./Input";
import Textarea from "./Textarea";
import InterestPicker from "./InterestPicker";
import LocationCapture, { CapturedLocation } from "./LocationCapture";
import ConfirmDialog from "./ConfirmDialog";
import FollowUpTimeline from "./FollowUpTimeline";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { deleteVisit, updateVisit } from "@/lib/api";
import { InterestLevel, VisitRecord } from "@/types";

interface VisitDetailsModalProps {
  visit: VisitRecord;
  onClose: () => void;
  onUpdated: (updated: VisitRecord) => void;
  onDeleted: (visitId: string) => void;
}

const interestBadge: Record<string, { icon: typeof Flame; classes: string }> = {
  Hot: { icon: Flame, classes: "bg-red-50 text-red-600" },
  Warm: { icon: Sun, classes: "bg-amber-50 text-amber-600" },
  Cold: { icon: Snowflake, classes: "bg-ink-50 text-ink-500" },
};

function formatDateTime(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function Field({ label, value, full = false }: { label: string; value?: string | number | null; full?: boolean }) {
  const display = value === 0 ? "0" : value || "—";
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className="whitespace-pre-wrap break-words text-sm font-body text-ink-900">{display}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <h4 className="mb-2 font-display text-xs font-bold uppercase tracking-wide text-ink-500">{title}</h4>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

type EditForm = {
  school_name: string;
  visitor: string;
  designation: string;
  mobile: string;
  address: string;
  students: string;
  teachers: string;
  current_software: string;
  interest: InterestLevel | "";
  report: string;
  notes: string;
  google_map: string;
  latitude: string;
  longitude: string;
  accuracy: string;
};

function toEditForm(v: VisitRecord): EditForm {
  return {
    school_name: v.school_name || "",
    visitor: v.visitor || "",
    designation: v.designation || "",
    mobile: v.mobile || "",
    address: v.address || "",
    students: v.students || "",
    teachers: v.teachers || "",
    current_software: v.current_software || "",
    interest: v.interest || "",
    report: v.report || "",
    notes: v.notes || "",
    google_map: v.google_map || "",
    latitude: v.latitude || "",
    longitude: v.longitude || "",
    accuracy: v.accuracy || "",
  };
}

export default function VisitDetailsModal({ visit, onClose, onUpdated, onDeleted }: VisitDetailsModalProps) {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [form, setForm] = useState<EditForm>(() => toEditForm(visit));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const canManage =
    !!user &&
    (user.role === "admin" || (visit.username || "").trim().toLowerCase() === user.username.trim().toLowerCase());

  const badge = interestBadge[visit.interest as string] || null;
  const BadgeIcon = badge?.icon;

  function update<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleLocationCapture(location: CapturedLocation) {
    setForm((prev) => ({
      ...prev,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      google_map: location.google_map,
    }));
  }

  function startEdit() {
    setForm(toEditForm(visit));
    setMode("edit");
  }

  async function handleSave() {
    if (!user || !visit.visit_id) return;
    if (!form.school_name.trim() || !form.visitor.trim() || !form.mobile.trim()) {
      showError("School name, visitor, and mobile are required.");
      return;
    }
    if (!form.interest) {
      showError("Please select an interest level.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateVisit({
        requestedBy: user.username,
        visit_id: visit.visit_id,
        ...form,
      });
      if (res.success) {
        showSuccess("Visit updated.");
        onUpdated({
          ...visit,
          ...form,
          updated_by: user.username,
          updated_at: new Date().toISOString(),
        });
        setMode("view");
      } else {
        showError(res.message || "Could not update visit.");
      }
    } catch {
      showError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!user || !visit.visit_id) return;
    setIsDeleting(true);
    try {
      const res = await deleteVisit({ requestedBy: user.username, visit_id: visit.visit_id });
      if (res.success) {
        showSuccess("Visit deleted.");
        onDeleted(visit.visit_id);
        setShowDeleteConfirm(false);
        onClose();
      } else {
        showError(res.message || "Could not delete visit.");
      }
    } catch {
      showError("Network error. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Modal title={mode === "edit" ? "Edit Visit" : visit.school_name || "Visit Details"} onClose={onClose}>
        {mode === "view" ? (
          <div>
            {badge && BadgeIcon && (
              <span
                className={`mb-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.classes}`}
              >
                <BadgeIcon className="h-3 w-3" />
                {visit.interest}
              </span>
            )}

            <Section title="School Information">
              <Field label="School Name" value={visit.school_name} full />
              <Field label="Address" value={visit.address} full />
              <Field label="Latitude" value={visit.latitude} />
              <Field label="Longitude" value={visit.longitude} />
              <Field label="Accuracy" value={visit.accuracy ? `±${visit.accuracy} m` : ""} />
            </Section>

            {visit.google_map && (
              <a
                href={visit.google_map}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl2 bg-ink-800 px-4 py-3 text-sm font-semibold text-white shadow-card active:scale-[0.98]"
              >
                <MapPin className="h-4 w-4" /> Open in Google Maps
              </a>
            )}

            <Section title="Contact Person">
              <Field label="Visitor" value={visit.visitor} />
              <Field label="Designation" value={visit.designation} />
              <Field label="Mobile" value={visit.mobile} full />
            </Section>

            <Section title="School Details">
              <Field label="Students" value={visit.students} />
              <Field label="Teachers" value={visit.teachers} />
              <Field label="Current Software" value={visit.current_software} full />
            </Section>

            <Section title="Sales">
              <Field label="Interest" value={visit.interest} />
              <Field label="Follow-up" value={visit.followup} />
              <Field label="Report" value={visit.report} full />
              <Field label="Notes" value={visit.notes} full />
            </Section>

            <Section title="Visit Information">
              <Field label="Executive" value={visit.executive} />
              <Field label="Username" value={visit.username} />
              <Field label="Date" value={visit.date} />
              <Field label="Timestamp" value={formatDateTime(visit.timestamp)} />
            </Section>

            <div className="mb-5">
              <div className="mb-2 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-ink-400" />
                <h4 className="font-display text-xs font-bold uppercase tracking-wide text-ink-500">
                  Visit Timeline
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Created By" value={visit.created_by || visit.username} />
                <Field label="Created Time" value={formatDateTime(visit.timestamp)} />
                <Field label="Updated By" value={visit.updated_by} />
                <Field label="Updated Time" value={formatDateTime(visit.updated_at)} />
                <Field label="Deleted By" value={visit.deleted_by} />
                <Field label="Deleted Time" value={formatDateTime(visit.deleted_at)} />
              </div>
            </div>

            <div className="mb-1 border-t border-ink-50 pt-4">
              <FollowUpTimeline visit={visit} />
            </div>

            {canManage && (
              <div className="mt-5 flex gap-3 border-t border-ink-50 pt-4">
                <Button variant="ghost" onClick={startEdit}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button
                  variant="secondary"
                  className="!bg-red-600 !text-white hover:!bg-red-700"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Input label="School Name" value={form.school_name} onChange={(e) => update("school_name", e.target.value)} required />
            <Input label="Visitor" value={form.visitor} onChange={(e) => update("visitor", e.target.value)} required />
            <Input label="Designation" value={form.designation} onChange={(e) => update("designation", e.target.value)} />
            <Input label="Mobile" type="tel" value={form.mobile} onChange={(e) => update("mobile", e.target.value)} required />
            <Textarea label="Address" value={form.address} onChange={(e) => update("address", e.target.value)} rows={2} />

            <LocationCapture
              value={
                form.latitude && form.longitude
                  ? {
                      latitude: form.latitude,
                      longitude: form.longitude,
                      accuracy: form.accuracy,
                      google_map: form.google_map,
                    }
                  : null
              }
              onCapture={handleLocationCapture}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input label="Students" type="number" inputMode="numeric" value={form.students} onChange={(e) => update("students", e.target.value)} />
              <Input label="Teachers" type="number" inputMode="numeric" value={form.teachers} onChange={(e) => update("teachers", e.target.value)} />
            </div>
            <Input label="Current Software" value={form.current_software} onChange={(e) => update("current_software", e.target.value)} />

            <InterestPicker value={form.interest} onChange={(val) => update("interest", val)} />
            <Textarea label="Report" value={form.report} onChange={(e) => update("report", e.target.value)} rows={3} />
            <Textarea label="Notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} />
            <p className="text-xs font-body text-ink-400">
              Follow-up scheduling has moved to the Follow-up Timeline below — close editing to add or update a
              follow-up entry.
            </p>

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setMode("view")} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} isLoading={isSaving}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete this visit?"
          message={`This will permanently remove "${visit.school_name}" from your visit history. This cannot be undone.`}
          confirmLabel="Delete"
          tone="danger"
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}
