import { memo } from "react";
import { School, MapPin, Flame, Sun, Snowflake } from "lucide-react";
import Card from "./Card";
import { VisitRecord } from "@/types";

interface VisitCardProps {
  visit: VisitRecord;
  onSelect: (visit: VisitRecord) => void;
  showExecutive?: boolean;
  showNotes?: boolean;
}

const interestBadge: Record<string, { icon: typeof Flame; classes: string }> = {
  Hot: { icon: Flame, classes: "bg-red-50 text-red-600" },
  Warm: { icon: Sun, classes: "bg-amber-50 text-amber-600" },
  Cold: { icon: Snowflake, classes: "bg-ink-50 text-ink-500" },
};

function VisitCard({ visit: v, onSelect, showExecutive = false, showNotes = false }: VisitCardProps) {
  const badge = interestBadge[v.interest as string] || null;
  const Icon = badge?.icon;

  return (
    <Card
      className="flex cursor-pointer flex-col gap-2 transition active:scale-[0.99]"
      onClick={() => onSelect(v)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-700">
            <School className="h-4 w-4" />
          </div>
          <div>
            <p className="font-display text-sm font-bold text-ink-900">{v.school_name}</p>
            <p className="text-xs font-body text-ink-400">
              {v.date}
              {showExecutive && v.executive ? ` · ${v.executive}` : ""}
            </p>
          </div>
        </div>
        {badge && Icon && (
          <span
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.classes}`}
          >
            <Icon className="h-3 w-3" />
            {v.interest}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-xs font-body text-ink-500">
        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">{v.address}</span>
      </div>
      {v.google_map && (
        <a
          href={v.google_map}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="w-fit text-xs font-body text-blue-600 underline"
        >
          View on Google Maps
        </a>
      )}
      {showNotes && v.notes && (
        <p className="line-clamp-2 text-xs font-body text-ink-400">{v.notes}</p>
      )}
    </Card>
  );
}

export default memo(VisitCard);
