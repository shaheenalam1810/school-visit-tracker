"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Users, GraduationCap } from "lucide-react";
import LocationCapture, { CapturedLocation } from "@/components/LocationCapture";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import Button from "@/components/Button";
import InterestPicker from "@/components/InterestPicker";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { submitVisit } from "@/lib/api";
import { todayISO } from "@/lib/date";
import { VisitPayload } from "@/types";

const EMPTY_FORM = (executiveName: string, username: string): VisitPayload => ({
  date: todayISO(),
  username,
  executive: executiveName,
  school_name: "",
  visitor: "",
  designation: "",
  mobile: "",
  address: "",
google_map: "",
latitude: "",
longitude: "",
accuracy: "",
instruction: "",
  students: "",
  teachers: "",
  current_software: "",
  interest: "",
  report: "",
  followup: "",
  notes: "",
});

function SectionTitle({ step, label }: { step: string; label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-800 text-[11px] font-bold text-white">
        {step}
      </span>
      <h3 className="font-display text-sm font-bold text-ink-900">{label}</h3>
    </div>
  );
}

function NewVisitContent() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const router = useRouter();

  const [form, setForm] = useState<VisitPayload>(() =>
    EMPTY_FORM(user?.name || "", user?.username || "")
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLocationCaptured = Boolean(form.latitude && form.longitude);

function handleLocationCapture(location: CapturedLocation) {
  setForm((prev) => ({
    ...prev,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    google_map: location.google_map,
  }));
}

  function update<K extends keyof VisitPayload>(key: K, value: VisitPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (!form.school_name.trim()) return "School name is required.";
    if (!form.visitor.trim()) return "Visitor name is required.";
    if (!form.mobile.trim()) return "Mobile number is required.";
    if (!/^[0-9+\-\s]{7,15}$/.test(form.mobile.trim())) return "Please enter a valid mobile number.";
    if (!form.interest) return "Please select an interest level.";
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const error = validate();
    if (error) {
      showError(error);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitVisit(form);
      if (res.success) {
        showSuccess("Visit submitted and saved to Google Sheets.");
        router.push("/dashboard");
      } else {
        showError(res.message || "Failed to submit the visit. Please try again.");
      }
    } catch (err) {
      showError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen pb-16">
      <TopBar title="New Visit" showBack />

      <form onSubmit={handleSubmit} className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-5">
        {/* Section 1: School & Visitor */}
        <Card>
          <SectionTitle step="1" label="School & Visitor Details" />
          <div className="flex flex-col gap-4">
            <Input label="Date" type="date" value={form.date} onChange={(e) => update("date", e.target.value)} required />
            <Input
              label="Marketing Executive Name"
              value={form.executive}
              onChange={(e) => update("executive", e.target.value)}
              placeholder="Your name"
              required
            />
            <Input
              label="School Name"
              icon={<GraduationCap className="h-4 w-4" />}
              value={form.school_name}
              onChange={(e) => update("school_name", e.target.value)}
              placeholder="e.g. Greenwood High School"
              required
            />
            <Input
              label="Visitor Name"
              icon={<Users className="h-4 w-4" />}
              value={form.visitor}
              onChange={(e) => update("visitor", e.target.value)}
              placeholder="Person you met"
              required
            />
            <Input
              label="Designation"
              value={form.designation}
              onChange={(e) => update("designation", e.target.value)}
              placeholder="e.g. Principal, IT In-charge"
            />
            <Input
              label="Mobile Number"
              type="tel"
              value={form.mobile}
              onChange={(e) => update("mobile", e.target.value)}
              placeholder="e.g. 01712345678"
              required
            />
          </div>
        </Card>

        {/* Section 2: Location */}
        <Card>
          <SectionTitle step="2" label="Location" />
          <div className="flex flex-col gap-4">
            <Textarea
              label="School Address"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="Full address of the school"
              rows={2}
            />
            <LocationCapture
  value={
    isLocationCaptured
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
            <Textarea
              label="Address Instruction"
              value={form.instruction}
              onChange={(e) => update("instruction", e.target.value)}
              placeholder="Landmarks or directions to reach the school"
              rows={2}
            />
          </div>
        </Card>

        {/* Section 3: School Profile */}
        <Card>
          <SectionTitle step="3" label="School Profile" />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Student Count"
              type="number"
              inputMode="numeric"
              value={form.students}
              onChange={(e) => update("students", e.target.value)}
              placeholder="0"
            />
            <Input
              label="Teacher Count"
              type="number"
              inputMode="numeric"
              value={form.teachers}
              onChange={(e) => update("teachers", e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="mt-4">
            <Input
              label="Current Software"
              value={form.current_software}
              onChange={(e) => update("current_software", e.target.value)}
              placeholder="Software currently used by the school, if any"
            />
          </div>
        </Card>

        {/* Section 4: Assessment */}
        <Card>
          <SectionTitle step="4" label="Visit Assessment" />
          <div className="flex flex-col gap-4">
            <InterestPicker
              value={form.interest}
              onChange={(val) => update("interest", val)}
            />
            <Textarea
              label="School Report"
              value={form.report}
              onChange={(e) => update("report", e.target.value)}
              placeholder="Summary of the school's needs, infrastructure, decision process, etc."
              rows={3}
            />
            <Input
              label="Next Follow-up Date"
              type="date"
              value={form.followup}
              onChange={(e) => update("followup", e.target.value)}
            />
            <Textarea
              label="Notes"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Anything else worth remembering"
              rows={3}
            />
          </div>
        </Card>

        <Button
  type="submit"
  isLoading={isSubmitting}
  disabled={!isLocationCaptured}
  className="mt-1"
>
  <Send className="h-5 w-5" />
  {isSubmitting
    ? "Submitting..."
    : isLocationCaptured
    ? "Submit Visit"
    : "Capture Location to Submit"}
</Button>
      </form>
    </div>
  );
}

export default function NewVisitPage() {
  return (
    <ProtectedRoute>
      <NewVisitContent />
    </ProtectedRoute>
  );
}
