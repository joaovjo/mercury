import { CalendarIcon, VideoCameraIcon } from "@phosphor-icons/react";
import { useResource } from "@/hooks/useResource";
import { useLiveTable } from "@/hooks/useLiveTable";
import { api } from "@/lib/api";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import type { Interview } from "@/types";

function daysUntil(d?: string): number | null {
  if (!d) return null;
  const parsed = Date.parse(d);
  if (isNaN(parsed)) return null;
  return Math.ceil((parsed - Date.now()) / 86400000);
}

export function InterviewsSection() {
  const interviews = useResource<Interview[]>(() => api<Interview[]>("interviews"), []);
  useLiveTable("interviews", interviews.reload);

  const list = interviews.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Interviews</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {interviews.status === "ready" ? `${list.length} scheduled` : "—"}
        </p>
      </div>

      {interviews.status === "loading" && <LoadingState rows={4} />}
      {interviews.status === "error" && <ErrorState error={interviews.error} onretry={interviews.reload} />}
      {interviews.status === "ready" && list.length === 0 && (
        <EmptyState message="No interviews scheduled yet." />
      )}

      {interviews.status === "ready" && list.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((iv, idx) => {
            const d = daysUntil(iv.scheduled_at);
            return (
              <div
                key={iv.id ?? idx}
                className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between shadow-xs hover:border-primary/40 transition-colors"
              >
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <VideoCameraIcon className="size-3.5 text-primary" />
                    <span>{iv.company}</span>
                  </div>
                  <div className="text-lg font-bold tracking-tight text-foreground mt-3">
                    {iv.scheduled_at ? new Date(iv.scheduled_at).toLocaleString() : "TBD"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {iv.stage ? `${iv.stage} · ` : ""}
                    <span className="capitalize">{iv.status}</span>
                    {d != null && d >= 0 && (
                      <div className="text-amber-500 font-semibold mt-1">
                        in {d} {d === 1 ? "day" : "days"}
                      </div>
                    )}
                  </div>
                </div>

                {iv.notes && (
                  <div className="mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground leading-relaxed">
                    {iv.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
