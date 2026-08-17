import {
  PaperPlaneTiltIcon,
  ClockIcon,
  ProhibitIcon,
  EnvelopeSimpleIcon,
  ArrowSquareOutIcon,
} from "@phosphor-icons/react";
import { useResource } from "@/hooks/useResource";
import { useLiveTable } from "@/hooks/useLiveTable";
import { api } from "@/lib/api";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Badge } from "@/components/ui/badge";
import type { OutreachData } from "@/types";

const FUNNEL = [
  { key: "queued", label: "Queued", color: "bg-muted-foreground/40", text: "text-muted-foreground" },
  { key: "invited", label: "Invited", color: "bg-primary", text: "text-primary" },
  { key: "accepted", label: "Accepted", color: "bg-sky-500", text: "text-sky-500" },
  { key: "followed_up", label: "Followed up", color: "bg-amber-500", text: "text-amber-500" },
  { key: "engaged", label: "Engaged", color: "bg-emerald-500", text: "text-emerald-500" },
  { key: "invite_ignored", label: "Invite ignored", color: "bg-rose-500", text: "text-rose-500" },
  { key: "unresponsive", label: "Unresponsive", color: "bg-rose-500", text: "text-rose-500" },
  { key: "do_not_contact", label: "Do not contact", color: "bg-muted-foreground/30", text: "text-muted-foreground" },
];

const ACTION_CONFIG = {
  withdraw: { label: "WITHDRAW", badge: "bg-rose-500/10 text-rose-500 border-rose-500/30" },
  followup: { label: "FOLLOW UP", badge: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  close: { label: "CLOSE", badge: "bg-muted text-muted-foreground border-border" },
};

export function OutreachSection() {
  const outreach = useResource<OutreachData | null>(() => api<OutreachData>("outreach"), null);
  useLiveTable("outreach_attempts", outreach.reload);

  const d = outreach.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Outreach</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Relationship memory — who you've contacted, what's due, and your InMail budget
        </p>
      </div>

      {outreach.status === "loading" && <LoadingState rows={4} />}
      {outreach.status === "error" && <ErrorState error={outreach.error} onretry={outreach.reload} />}

      {outreach.status === "ready" && d && (
        <>
          {/* Funnel Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FUNNEL.map((s) => (
              <div key={s.key} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-xs">
                <span className={`flex items-center gap-2 text-xs font-semibold ${s.text}`}>
                  <span className={`size-2 rounded-full ${s.color}`} />
                  {s.label}
                </span>
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {d.funnel[s.key] ?? 0}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Due Today (spans 2) */}
            <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClockIcon className="size-5 text-amber-500" />
                  <h3 className="text-base font-semibold text-foreground">Due today</h3>
                </div>
                {d.due.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {d.due.length}
                  </Badge>
                )}
              </div>

              {d.due.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  Nothing due today — you're all caught up!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {d.due.map((item, idx) => {
                    const action = ACTION_CONFIG[item.actionKind] ?? ACTION_CONFIG.close;
                    return (
                      <div
                        key={item.id ?? idx}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20 text-xs"
                      >
                        <span
                          className={`shrink-0 mt-0.5 px-2 py-0.5 rounded font-bold tracking-wider border ${action.badge}`}
                        >
                          {action.label}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground truncate">
                            {item.person_username ? (
                              <a
                                href={`https://www.linkedin.com/in/${item.person_username}/`}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:text-primary transition-colors inline-flex items-center gap-1"
                              >
                                {item.person_name ?? item.person_username}
                                <ArrowSquareOutIcon className="size-3 text-muted-foreground" />
                              </a>
                            ) : (
                              item.person_name ?? "—"
                            )}
                            <span className="text-muted-foreground font-normal">
                              {" "}
                              @ {item.company_name ?? item.company_urn}
                            </span>
                          </div>
                          <div className="text-muted-foreground mt-0.5">{item.actionReason}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: InMail budget + Blocked */}
            <div className="space-y-6">
              {/* InMail Budget Card */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <EnvelopeSimpleIcon className="size-5 text-primary" />
                    <h3 className="text-base font-semibold text-foreground">InMail budget</h3>
                  </div>
                  <span className="text-[0.68rem] uppercase tracking-wider font-semibold text-muted-foreground">
                    {d.budget.plan}
                  </span>
                </div>

                <div>
                  <div className="text-3xl font-bold tracking-tight text-foreground">
                    {d.budget.credits_remaining}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">credits remaining</div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-2">
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <div className="text-sm font-bold text-foreground">{d.budget.reserve_floor}</div>
                    <div className="text-[0.65rem] text-muted-foreground uppercase tracking-wider mt-0.5">floor</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <div className="text-sm font-bold text-foreground">{d.budget.credits_used_this_cycle}</div>
                    <div className="text-[0.65rem] text-muted-foreground uppercase tracking-wider mt-0.5">used</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <div className="text-sm font-bold text-foreground">{d.budget.inmail_monthly_allotment}</div>
                    <div className="text-[0.65rem] text-muted-foreground uppercase tracking-wider mt-0.5">monthly</div>
                  </div>
                </div>
              </div>

              {/* Blocked by Company */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <ProhibitIcon className="size-5 text-rose-500" />
                  <h3 className="text-base font-semibold text-foreground">Blocked companies</h3>
                </div>

                {d.blocked.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">No companies blocked.</div>
                ) : (
                  <div className="space-y-2">
                    {d.blocked.map((b, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1">
                        <span className="text-foreground font-medium truncate flex-1 pr-2">
                          {b.company_name ?? b.company_urn}
                        </span>
                        <Badge variant="destructive" className="text-[0.65rem] px-1.5 py-0.5">
                          {b.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
