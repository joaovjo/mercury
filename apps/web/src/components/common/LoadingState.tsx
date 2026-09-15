import { Skeleton } from "@/components/ui/skeleton";

interface LoadingStateProps {
  rows?: number;
}

const widths = ["92%", "78%", "85%", "70%", "88%"];

export function LoadingState({ rows = 3 }: LoadingStateProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3 shadow-xs">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4 rounded-md"
          style={{ width: widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}
