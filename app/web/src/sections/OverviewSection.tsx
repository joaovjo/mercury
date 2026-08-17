import { GaugeIcon, UsersIcon, CheckCircleIcon, ArrowBendUpLeftIcon, VideoCameraIcon, BookmarkSimpleIcon, ScanIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { FormattedMessage } from "react-intl";
import { useResource } from "@/hooks/useResource";
import { useLiveTable } from "@/hooks/useLiveTable";
import { api } from "@/lib/api";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { OverviewData } from "@/types";

interface OverviewSectionProps {
  onnav: (id: string) => void;
}

function pillVariant(value: string): "default" | "destructive" | "secondary" {
  const v = String(value).toLowerCase();
  if (["true", "strong", "good", "ok", "yes", "done", "set"].some((s) => v.includes(s))) return "default";
  if (["weak", "missing", "empty", "none", "no", "false", "todo"].some((s) => v.includes(s))) return "destructive";
  return "secondary";
}

export function OverviewSection({ onnav }: OverviewSectionProps) {
  const overview = useResource<OverviewData | null>(() => api<OverviewData>("overview"), null);

  useLiveTable(["recruiters", "jobs", "interviews", "applications", "profile_metrics"], overview.reload);

  const ov = overview.data;
  const breakdown = ov?.breakdown ?? [];
  const score = ov?.score ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          <FormattedMessage id="overview.title" defaultMessage="Overview" />
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          <FormattedMessage id="overview.subtitle" defaultMessage="Your job search at a glance" />
        </p>
      </div>

      {overview.status === "loading" && <LoadingState rows={4} />}
      {overview.status === "error" && <ErrorState error={overview.error} onretry={overview.reload} />}

      {overview.status === "ready" && ov && (
        <>
          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Hero Profile Score (spans 2x2) */}
            <div
              className="lg:col-span-2 lg:row-span-2 rounded-xl border border-border bg-card p-6 flex flex-col justify-between relative overflow-hidden group hover:border-primary/50 transition-all cursor-pointer shadow-xs"
              role="button"
              tabIndex={0}
              onClick={() => onnav("profile")}
              onKeyDown={(e) => e.key === "Enter" && onnav("profile")}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="z-10">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <GaugeIcon className="size-5 text-primary" />{" "}
                  <FormattedMessage id="overview.profileScore.title" defaultMessage="Profile Score" />
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  <FormattedMessage id="overview.profileScore.subtitle" defaultMessage="Recruiter-search visibility" />
                </p>
              </div>
              <div className="mt-8 z-10 flex items-baseline gap-2">
                {score != null ? (
                  <>
                    <span className="text-6xl font-bold tracking-tight text-foreground">{score}</span>
                    <span className="text-xl text-muted-foreground font-normal">/100</span>
                  </>
                ) : (
                  <span className="text-2xl font-semibold text-muted-foreground">
                    <FormattedMessage id="overview.profileScore.notScanned" defaultMessage="Not scanned" />
                  </span>
                )}
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full mt-6 overflow-hidden z-10">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${score ?? 0}%` }}
                />
              </div>
            </div>

            {/* Recruiters Card */}
            <div
              className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between cursor-pointer hover:border-primary/40 transition-colors shadow-xs"
              role="button"
              tabIndex={0}
              onClick={() => onnav("recruiters")}
              onKeyDown={(e) => e.key === "Enter" && onnav("recruiters")}
            >
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                <UsersIcon className="size-4 text-muted-foreground" />{" "}
                <FormattedMessage id="overview.recruiters" defaultMessage="Recruiters" />
              </div>
              <div className="text-3xl font-bold tracking-tight mt-4">{ov.recruiters}</div>
            </div>

            {/* Accepted Card */}
            <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between shadow-xs">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                <CheckCircleIcon className="size-4 text-emerald-500" />{" "}
                <FormattedMessage id="overview.accepted" defaultMessage="Accepted" />
              </div>
              <div className="text-3xl font-bold tracking-tight mt-4 text-emerald-500">{ov.accepted}</div>
            </div>

            {/* Replied Card */}
            <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between shadow-xs">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                <ArrowBendUpLeftIcon className="size-4 text-primary" />{" "}
                <FormattedMessage id="overview.replied" defaultMessage="Replied" />
              </div>
              <div className="text-3xl font-bold tracking-tight mt-4 text-primary">{ov.replied}</div>
            </div>

            {/* Interviews Card */}
            <div
              className="rounded-xl border border-primary/30 bg-primary/10 p-5 flex flex-col justify-between cursor-pointer hover:bg-primary/15 transition-colors shadow-xs"
              role="button"
              tabIndex={0}
              onClick={() => onnav("interviews")}
              onKeyDown={(e) => e.key === "Enter" && onnav("interviews")}
            >
              <div className="text-xs font-semibold text-primary flex items-center gap-2">
                <VideoCameraIcon className="size-4" />{" "}
                <FormattedMessage id="overview.interviews" defaultMessage="Interviews" />
              </div>
              <div className="text-3xl font-bold tracking-tight text-foreground mt-4">{ov.interviews}</div>
            </div>

            {/* Jobs Saved Card (wide row) */}
            <div
              className="lg:col-span-2 rounded-xl border border-border bg-card p-5 flex items-center justify-between cursor-pointer hover:border-primary/40 transition-colors shadow-xs"
              role="button"
              tabIndex={0}
              onClick={() => onnav("jobs")}
              onKeyDown={(e) => e.key === "Enter" && onnav("jobs")}
            >
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-full bg-muted flex items-center justify-center border border-border text-foreground">
                  <BookmarkSimpleIcon className="size-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    <FormattedMessage id="overview.jobsSaved.title" defaultMessage="Jobs Saved" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <FormattedMessage id="overview.jobsSaved.subtitle" defaultMessage="Ready to apply" />
                  </div>
                </div>
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground">{ov.jobs}</div>
            </div>
          </div>

          {/* Bottom Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {breakdown.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-foreground">
                    <FormattedMessage id="overview.breakdown.title" defaultMessage="Profile breakdown" />
                  </h3>
                  <button
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                    onClick={() => onnav("profile")}
                  >
                    <FormattedMessage id="common.viewDetails" defaultMessage="view details" />{" "}
                    <ArrowRightIcon className="size-3" />
                  </button>
                </div>
                <div className="divide-y divide-border/60">
                  {breakdown.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="capitalize text-muted-foreground">{item.label}</span>
                      {item.value && (
                        <Badge variant={pillVariant(item.value)} className="capitalize text-[0.7rem] px-2 py-0.5">
                          {item.value}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between shadow-xs">
              <div>
                <h3 className="text-base font-semibold text-foreground mb-4">
                  <FormattedMessage id="overview.pipeline.title" defaultMessage="Pipeline health" />
                </h3>
                <div className="p-4 rounded-lg bg-muted/40 border border-border text-sm leading-relaxed text-muted-foreground">
                  <strong className="text-foreground font-semibold">
                    <FormattedMessage
                      id="overview.pipeline.recruitersContacted"
                      defaultMessage="{count} recruiters contacted"
                      values={{ count: ov.recruiters }}
                    />
                  </strong>{" "}
                  ·{" "}
                  <strong className="text-emerald-500 font-semibold">
                    <FormattedMessage
                      id="overview.pipeline.accepted"
                      defaultMessage="{count} accepted"
                      values={{ count: ov.accepted }}
                    />
                  </strong>{" "}
                  ·{" "}
                  <strong className="text-primary font-semibold">
                    <FormattedMessage
                      id="overview.pipeline.replied"
                      defaultMessage="{count} replied"
                      values={{ count: ov.replied }}
                    />
                  </strong>{" "}
                  ·{" "}
                  <strong className="text-primary font-semibold">
                    <FormattedMessage
                      id="overview.pipeline.interviewsScheduled"
                      defaultMessage="{count} interviews scheduled."
                      values={{ count: ov.interviews }}
                    />
                  </strong>
                  {score === null && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      <FormattedMessage
                        id="overview.pipeline.runScanHint"
                        defaultMessage="Run a profile scan to capture your first score and breakdown."
                      />
                    </p>
                  )}
                </div>
              </div>
              <Button className="w-full mt-6" onClick={() => onnav("profile")}>
                <ScanIcon className="size-4 mr-1.5" />{" "}
                <FormattedMessage id="overview.scanProfile" defaultMessage="Scan profile" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

