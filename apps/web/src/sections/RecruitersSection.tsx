import { useState } from "react";
import {
  ArrowsClockwiseIcon,
  ClockIcon,
  MapPinIcon,
  ArrowSquareOutIcon,
  CheckCircleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { FormattedMessage, useIntl } from "react-intl";
import { useResource } from "@/hooks/useResource";
import { useLiveTable } from "@/hooks/useLiveTable";
import { api, post } from "@/lib/api";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import type { Recruiter, DueFollowUp, SyncResponse } from "@/types";

const COLS: Array<Recruiter["status"]> = [
  "pending",
  "accepted",
  "replied",
  "interviewing",
  "closed",
];

const STATUS_I18N: Record<Recruiter["status"], string> = {
  pending: "recruiters.status.pending",
  accepted: "recruiters.status.accepted",
  replied: "recruiters.status.replied",
  interviewing: "recruiters.status.interviewing",
  closed: "recruiters.status.closed",
};

const ACCENT: Record<Recruiter["status"], string> = {
  pending: "border-l-muted-foreground/40",
  accepted: "border-l-emerald-500",
  replied: "border-l-primary",
  interviewing: "border-l-emerald-500",
  closed: "border-l-muted-foreground/30",
};

export function RecruitersSection() {
  const intl = useIntl();
  const recruiters = useResource<Recruiter[]>(() => api<Recruiter[]>("recruiters"), []);
  useLiveTable("recruiters", recruiters.reload);

  const due = useResource<DueFollowUp[]>(() => api<DueFollowUp[]>("recruiters/due"), []);
  useLiveTable("recruiters", due.reload);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await post<SyncResponse>("recruiters/sync", { apply: true });
      const n = r.changes?.length ?? 0;
      let text =
        n === 0
          ? intl.formatMessage(
              {
                id: "recruiters.sync.noNew",
                defaultMessage: "No new acceptances (scanned {scanned} pending across {companies}).",
              },
              { scanned: r.scanned, companies: r.companiesQueried }
            )
          : intl.formatMessage(
              {
                id: "recruiters.sync.newlyAccepted",
                defaultMessage: "{count} newly accepted: {names}",
              },
              { count: n, names: r.changes.map((c) => c.name).join(", ") }
            );
      if (r.skipped?.length) {
        text += ` · ${intl.formatMessage(
          {
            id: "recruiters.sync.skipped",
            defaultMessage: "skipped: {names}",
          },
          { names: r.skipped.join(", ") }
        )}`;
      }
      setSyncMsg({ ok: true, text });
      due.reload();
    } catch (e: unknown) {
      setSyncMsg({
        ok: false,
        text:
          e instanceof Error
            ? e.message
            : intl.formatMessage({
                id: "recruiters.sync.failed",
                defaultMessage: "Sync failed (is LinkedIn reachable?)",
              }),
      });
    } finally {
      setSyncing(false);
    }
  }

  const list = recruiters.data ?? [];
  const byStatus = COLS.reduce<Record<string, Recruiter[]>>((acc, col) => {
    acc[col] = list.filter((r) => r.status === col);
    return acc;
  }, {});

  const dueList = due.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <FormattedMessage id="recruiters.title" defaultMessage="Recruiters" />
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {recruiters.status === "ready" ? (
              <FormattedMessage
                id="recruiters.subtitle"
                defaultMessage="{count, plural, one {# contact} other {# contacts}} across your outreach pipeline"
                values={{ count: list.length }}
              />
            ) : (
              "—"
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="shrink-0"
        >
          <ArrowsClockwiseIcon className={`size-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing
            ? intl.formatMessage({ id: "recruiters.syncing", defaultMessage: "Syncing…" })
            : intl.formatMessage({ id: "recruiters.sync", defaultMessage: "Sync now" })}
        </Button>
      </div>

      {syncMsg && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg border text-xs ${
            syncMsg.ok
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          {syncMsg.ok ? (
            <CheckCircleIcon className="size-4 shrink-0" />
          ) : (
            <WarningCircleIcon className="size-4 shrink-0" />
          )}
          <span>{syncMsg.text}</span>
        </div>
      )}

      {dueList.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <ClockIcon className="size-4 text-amber-500" />
            <span>
              <FormattedMessage id="recruiters.dueFollowUps" defaultMessage="Due follow-ups" />
            </span>
          </div>
          <div className="divide-y divide-border/60">
            {dueList.map((d, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 py-2 text-xs items-baseline">
                <span className="sm:col-span-2 font-bold uppercase tracking-wider text-amber-500">
                  {d.action}
                </span>
                <span className="sm:col-span-4 font-medium text-foreground">
                  {d.username ? (
                    <a
                      href={`https://www.linkedin.com/in/${d.username}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-primary transition-colors inline-flex items-center gap-1"
                    >
                      {d.name} <ArrowSquareOutIcon className="size-3 text-muted-foreground" />
                    </a>
                  ) : (
                    d.name
                  )}
                  <span className="text-muted-foreground font-normal"> · {d.company}</span>
                </span>
                <span className="sm:col-span-6 text-muted-foreground">{d.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recruiters.status === "loading" && <LoadingState rows={5} />}
      {recruiters.status === "error" && (
        <ErrorState error={recruiters.error} onretry={recruiters.reload} />
      )}
      {recruiters.status === "ready" && list.length === 0 && (
        <EmptyState
          message={intl.formatMessage({ id: "recruiters.empty", defaultMessage: "No recruiters yet." })}
          skill="recruiter-outreach"
        />
      )}

      {recruiters.status === "ready" && list.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLS.map((col) => {
            const count = byStatus[col]?.length ?? 0;
            const isInterviewing = col === "interviewing";
            const colLabel = intl.formatMessage({
              id: STATUS_I18N[col] ?? `recruiters.status.${col}`,
              defaultMessage: col,
            });
            return (
              <div
                key={col}
                className={`w-[290px] shrink-0 flex flex-col rounded-xl border p-3.5 shadow-xs ${
                  isInterviewing
                    ? "bg-card border-primary/40 ring-1 ring-primary/20"
                    : "bg-card/70 border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    {isInterviewing && <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />}
                    <span>{colLabel}</span>
                  </h4>
                  <span className="text-[0.7rem] font-semibold bg-muted px-2 py-0.5 rounded-full text-muted-foreground border border-border">
                    {count}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[580px] pr-1">
                  {byStatus[col]?.map((r, idx) => (
                    <div
                      key={r.id ?? idx}
                      className={`rounded-lg border border-border bg-card p-3.5 text-xs shadow-xs hover:border-primary/40 transition-all border-l-4 ${ACCENT[col]}`}
                    >
                      <div className="font-semibold text-foreground text-sm flex items-center justify-between">
                        {r.username ? (
                          <a
                            href={`https://www.linkedin.com/in/${r.username}/`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-primary transition-colors inline-flex items-center gap-1"
                          >
                            {r.name}
                            <ArrowSquareOutIcon className="size-3 text-muted-foreground" />
                          </a>
                        ) : (
                          r.name
                        )}
                      </div>

                      {(r.company || r.title) && (
                        <div className="text-muted-foreground mt-1">
                          {r.company}
                          {r.title ? ` · ${r.title}` : ""}
                        </div>
                      )}

                      {(r.location || r.degree) && (
                        <div className="text-muted-foreground flex items-center gap-1 mt-1 text-[0.75rem]">
                          <MapPinIcon className="size-3 text-muted-foreground/80 shrink-0" />
                          <span>
                            {r.location}
                            {r.degree ? ` · ${r.degree}` : ""}
                          </span>
                        </div>
                      )}

                      {r.note && (
                        <div className="mt-2.5 rounded bg-muted/40 border border-border p-1.5 text-[0.7rem] text-muted-foreground">
                          {r.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

