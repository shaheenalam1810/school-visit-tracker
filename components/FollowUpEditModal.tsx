"use client";

import { FormEvent, useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import Input from "./Input";
import Select from "./Select";
import Textarea from "./Textarea";
import { TYPE_OPTIONS, STATUS_OPTIONS } from "./FollowUpTimeline";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { updateFollowUp } from "@/lib/api";
import { FollowUpDashboardRecord, FollowUpStatus, FollowUpType } from "@/types";

export interface FollowUpEditFormValues {
  followup_date: string;
  next_followup_date: string;
  type: FollowUpType | "";
  status: FollowUpStatus | "";
  notes: string;
}

interface FollowUpEditModalProps {
  item: FollowUpDashboardRecord;
  onClose: () => void;
  onSaved: (followupId: string, updates: FollowUpEditFormValues) => void;
}

export default function FollowUpEditModal({ item, onClose, onSaved }: FollowUpEditModalProps) {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [form, setForm] = useState<FollowUpEditFormValues>({
    followup_date: item.followup_date || "",
    next_followup_date: item.next_followup_date || "",
    type: item.type || "",
    status: item.status || "",
    notes: item.notes || "",
  });
  const [isSaving, setIsSaving] = useState(false);

  function update<K extends keyof FollowUpEditFormValues>(key: K, value: FollowUpEditFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.followup_date || !form.type || !form.status) {
      showError("Follow-up date, type, and status are required.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateFollowUp({
        requestedBy: user.username,
        followup_id: item.followup_id,
        ...form,
      });
      if (res.success) {
        showSuccess("Follow-up updated.");
        onSaved(item.followup_id, form);
        onClose();
      } else {
        showError(res.message || "Could not update follow-up.");
      }
    } catch {
      showError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal title={`Edit Follow-up — ${item.visit.school_name || ""}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
        <Textarea label="Notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} />
        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
