import { FollowUpBucket, FollowUpStatus } from "@/types";

export const BUCKET_META: Record<
  FollowUpBucket,
  { label: string; badgeClasses: string; dot: string; cardBorderClass: string }
> = {
  overdue: {
    label: "Overdue",
    badgeClasses: "bg-red-50 text-red-600",
    dot: "bg-red-500",
    cardBorderClass: "border-l-4 border-l-red-500",
  },
  today: {
    label: "Today",
    badgeClasses: "bg-orange-50 text-orange-600",
    dot: "bg-orange-500",
    cardBorderClass: "border-l-4 border-l-orange-500",
  },
  tomorrow: {
    label: "Tomorrow",
    badgeClasses: "bg-yellow-100 text-yellow-700",
    dot: "bg-yellow-500",
    cardBorderClass: "border-l-4 border-l-yellow-500",
  },
  upcoming: {
    label: "Upcoming",
    badgeClasses: "bg-green-50 text-green-600",
    dot: "bg-green-500",
    cardBorderClass: "border-l-4 border-l-green-500",
  },
  completed: {
    label: "Completed",
    badgeClasses: "bg-blue-50 text-blue-600",
    dot: "bg-blue-500",
    cardBorderClass: "border-l-4 border-l-blue-500",
  },
  cancelled: {
    label: "Cancelled",
    badgeClasses: "bg-ink-100 text-ink-500",
    dot: "bg-ink-400",
    cardBorderClass: "border-l-4 border-l-ink-300",
  },
};

/** "Today" / "Tomorrow" / "22 July" — used for the /followups group headers. */
export function formatGroupDateLabel(dateISO: string, todayISO: string, tomorrowISO: string): string {
  if (!dateISO) return "No Date";
  if (dateISO === todayISO) return "Today";
  if (dateISO === tomorrowISO) return "Tomorrow";

  const [y, m, d] = dateISO.split("-").map(Number);
  if (!y || !m || !d) return dateISO;
  const date = new Date(y, m - 1, d);
  const month = date.toLocaleString("en-US", { month: "long" });
  return `${d} ${month}`;
}

/**
 * Mirrors Code.gs's computeFollowUpBucket() exactly, so the frontend
 * can optimistically re-bucket a follow-up after an edit/mark-completed
 * action without refetching the whole dashboard. Keep the two in sync.
 */
export function computeBucketClient(
  status: FollowUpStatus | "",
  nextFollowUpDate: string | undefined,
  todayISO: string,
  tomorrowISO: string
): FollowUpBucket {
  if (status === "Completed") return "completed";
  if (status === "Cancelled") return "cancelled";

  const next = nextFollowUpDate || "";
  if (!next) return "upcoming";
  if (next < todayISO) return "overdue";
  if (next === todayISO) return "today";
  if (next === tomorrowISO) return "tomorrow";
  return "upcoming";
}

/** Groups already-sorted items into contiguous same-date buckets for the /followups list headers. */
export function groupFollowUpsByDate<T extends { next_followup_date?: string }>(
  items: T[],
  todayISO: string,
  tomorrowISO: string
): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  const indexByLabel = new Map<string, number>();

  items.forEach((item) => {
    const label = formatGroupDateLabel(item.next_followup_date || "", todayISO, tomorrowISO);
    let idx = indexByLabel.get(label);
    if (idx === undefined) {
      idx = groups.length;
      indexByLabel.set(label, idx);
      groups.push({ label, items: [] });
    }
    groups[idx].items.push(item);
  });

  return groups;
}
