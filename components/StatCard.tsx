import { ReactNode, memo } from "react";
import Card from "./Card";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  accent?: "amber" | "ink";
}

function StatCard({ label, value, icon, accent = "ink" }: StatCardProps) {
  const accentClasses =
    accent === "amber" ? "bg-amber-50 text-amber-600" : "bg-ink-50 text-ink-800";

  return (
    <Card className="flex items-center gap-4">
      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${accentClasses}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-ink-900 leading-none">{value}</p>
        <p className="mt-1 text-xs font-body text-ink-400">{label}</p>
      </div>
    </Card>
  );
}

export default memo(StatCard);
