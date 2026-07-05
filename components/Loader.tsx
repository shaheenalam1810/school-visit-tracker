import { Loader2 } from "lucide-react";

export default function Loader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-ink-800" />
      <p className="text-sm font-body text-ink-400">{label}</p>
    </div>
  );
}
