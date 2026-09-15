import { FormattedMessage, useIntl } from "react-intl";
import { useResource } from "@/hooks/useResource";
import { useLiveTable } from "@/hooks/useLiveTable";
import { api } from "@/lib/api";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import type { ActivityItem } from "@/types";

export function ActivitySection() {
  const intl = useIntl();
  const activity = useResource<ActivityItem[]>(() => api<ActivityItem[]>("activity"), []);
  useLiveTable("activity_log", activity.reload);

  const list = activity.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          <FormattedMessage id="activity.title" defaultMessage="Activity" />
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          <FormattedMessage id="activity.subtitle" defaultMessage="Recent skill runs and actions" />
        </p>
      </div>

      {activity.status === "loading" && <LoadingState rows={5} />}
      {activity.status === "error" && <ErrorState error={activity.error} onretry={activity.reload} />}
      {activity.status === "ready" && list.length === 0 && (
        <EmptyState
          message={intl.formatMessage({
            id: "activity.empty",
            defaultMessage: "No activity logged yet.",
          })}
        />
      )}

      {activity.status === "ready" && list.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs divide-y divide-border/60">
          {list.map((a, idx) => (
            <div
              key={a.id ?? idx}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 text-xs hover:bg-muted/20 transition-colors"
            >
              <span className="text-muted-foreground font-mono shrink-0 min-w-[150px]">
                {intl.formatDate(new Date(a.ts), {
                  dateStyle: "short",
                  timeStyle: "medium",
                })}
              </span>
              {a.skill && (
                <Badge variant="secondary" className="w-fit text-[0.68rem] px-2 py-0.5 font-mono">
                  {a.skill}
                </Badge>
              )}
              <span className="text-foreground font-medium flex-1">
                {a.summary ?? a.kind ?? "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

