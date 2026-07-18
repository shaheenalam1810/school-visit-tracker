import { memo } from "react";
import { MapPin, Pencil, Trash2, CheckCircle2, ExternalLink, User, Phone as PhoneIcon } from "lucide-react";
import Card from "./Card";
import { TYPE_ICON } from "./FollowUpTimeline";
import { BUCKET_META } from "@/lib/followup";
import { FollowUpDashboardRecord } from "@/types";

interface FollowUpDashboardCardProps {
  item: FollowUpDashboardRecord;
  canManage: boolean;
  onOpenVisit: (item: FollowUpDashboardRecord) => void;
  onEdit: (item: FollowUpDashboardRecord) => void;
  onMarkCompleted: (item: FollowUpDashboardRecord) => void;
  onDelete: (item: FollowUpDashboardRecord) => void;
  isCompleting?: boolean;
}

function FollowUpDashboardCard({
  item,
  canManage,
  onOpenVisit,
  onEdit,
  onMarkCompleted,
  onDelete,
  isCompleting = false,
}: FollowUpDashboardCardProps) {
  const meta = BUCKET_META[item.bucket];
  const TypeIcon = TYPE_ICON[item.type as string] || PhoneIcon;
  const visit = item.visit;
  const isFinished = item.bucket === "completed" || item.bucket === "cancelled";

  return (
    <Card className={`flex flex-col gap-3 ${meta.cardBorderClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-ink-900">{visit.school_name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs font-body text-ink-500">
            <User className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {visit.visitor} &middot; {visit.mobile}
            </span>
          </p>
        </div>
        <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badgeClasses}`}>
          {meta.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs font-body">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Executive</p>
          <p className="truncate text-ink-800">{visit.executive || visit.username || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Last Visit</p>
          <p className="text-ink-800">{visit.date || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Last Follow-up</p>
          <p className="text-ink-800">{item.followup_date || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Next Follow-up</p>
          <p className="font-semibold text-ink-900">{item.next_followup_date || "—"}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs font-body text-ink-600">
        <TypeIcon className="h-3.5 w-3.5 flex-shrink-0 text-ink-400" />
        {item.type || "—"}
      </div>

      {item.notes && <p className="line-clamp-3 text-xs font-body text-ink-500">{item.notes}</p>}

      <div className="flex flex-wrap gap-2 border-t border-ink-50 pt-3">
        {visit.google_map && (
          <a
            href={visit.google_map}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-full bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-700 active:scale-95"
          >
            <MapPin className="h-3.5 w-3.5" /> Google Maps
          </a>
        )}
        <button
          onClick={() => onOpenVisit(item)}
          className="flex items-center gap-1 rounded-full bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-700 active:scale-95"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open Visit
        </button>
        {canManage && (
          <>
            <button
              onClick={() => onEdit(item)}
              className="flex items-center gap-1 rounded-full bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-700 active:scale-95"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            {!isFinished && (
              <button
                onClick={() => onMarkCompleted(item)}
                disabled={isCompleting}
                className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark Completed
              </button>
            )}
            <button
              onClick={() => onDelete(item)}
              className="flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 active:scale-95"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </>
        )}
      </div>
    </Card>
  );
}

export default memo(FollowUpDashboardCard);
