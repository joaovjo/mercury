import {
  LinkIcon,
  FunnelIcon,
  PlusIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import { FormattedMessage, useIntl } from "react-intl";
import { useResource } from "@/hooks/useResource";
import { useLiveTable } from "@/hooks/useLiveTable";
import { api } from "@/lib/api";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Application } from "@/types";

function derivedLabel(a: Application): string {
  if (a.job_title) return a.job_title;
  const path = a.resume_path || a.cover_letter_path || a.report_path;
  if (!path) return "—";
  const base = path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
  if (!base) return "—";
  return base.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function companyInitial(name?: string): string {
  return (name ?? "—").trim().charAt(0).toUpperCase() || "—";
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "submitted") return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
  if (s === "filled") return "bg-primary/10 text-primary border-primary/30";
  if (s === "needs_input") return "bg-amber-500/10 text-amber-500 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border";
}

export function ApplicationsSection() {
  const intl = useIntl();
  const apps = useResource<Application[]>(() => api<Application[]>("applications"), []);
  useLiveTable("applications", apps.reload);

  const list = apps.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          <FormattedMessage id="applications.title" defaultMessage="Applications" />
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          <FormattedMessage id="applications.subtitle" defaultMessage="Tailored resumes & cover letters" />
        </p>
      </div>

      {apps.status === "loading" && <LoadingState rows={5} />}
      {apps.status === "error" && <ErrorState error={apps.error} onretry={apps.reload} />}
      {apps.status === "ready" && list.length === 0 && (
        <EmptyState
          message={intl.formatMessage({ id: "applications.empty", defaultMessage: "No applications yet." })}
          skill="resume-tailor"
        />
      )}

      {apps.status === "ready" && list.length > 0 && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between pb-2 border-b border-border text-xs text-muted-foreground font-medium">
            <div className="flex items-center gap-2">
              <span>
                <FormattedMessage
                  id="applications.count"
                  defaultMessage="{count, plural, one {# Application} other {# Applications}}"
                  values={{ count: list.length }}
                />
              </span>
              <span className="opacity-40">•</span>
              <button className="hover:text-foreground transition-colors flex items-center gap-1 opacity-70" disabled>
                <FormattedMessage id="applications.filter" defaultMessage="Filter" />{" "}
                <FunnelIcon className="size-3.5" />
              </button>
            </div>
            <Button size="xs" disabled className="text-xs">
              <PlusIcon className="size-3 mr-1" />{" "}
              <FormattedMessage id="applications.newApplication" defaultMessage="New Application" />
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 uppercase tracking-wider text-muted-foreground font-semibold">
                    <th className="py-3 px-4 w-[28%]">
                      <FormattedMessage id="applications.table.role" defaultMessage="Role / Target" />
                    </th>
                    <th className="py-3 px-4">
                      <FormattedMessage id="applications.table.company" defaultMessage="Company" />
                    </th>
                    <th className="py-3 px-4">
                      <FormattedMessage id="applications.table.portal" defaultMessage="Portal" />
                    </th>
                    <th className="py-3 px-4">
                      <FormattedMessage id="applications.table.score" defaultMessage="Score" />
                    </th>
                    <th className="py-3 px-4">
                      <FormattedMessage id="applications.table.status" defaultMessage="Status" />
                    </th>
                    <th className="py-3 px-4 text-right">
                      <FormattedMessage id="applications.table.files" defaultMessage="Files" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {list.map((a, idx) => (
                    <tr key={a.id ?? idx} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {a.external_url ? (
                            <a
                              href={a.external_url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-foreground hover:text-primary transition-colors truncate max-w-[200px]"
                            >
                              {derivedLabel(a)}
                            </a>
                          ) : (
                            <span className="font-semibold text-foreground truncate max-w-[200px]">
                              {derivedLabel(a)}
                            </span>
                          )}
                          {!a.job_id && (
                            <span
                              className="text-[0.65rem] text-muted-foreground flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded border border-border shrink-0"
                              title={intl.formatMessage({
                                id: "applications.unlinkedTitle",
                                defaultMessage: "Not linked to a scouted job",
                              })}
                            >
                              <LinkIcon className="size-2.5" />{" "}
                              <FormattedMessage id="applications.unlinked" defaultMessage="unlinked" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="size-5 rounded bg-muted border border-border flex items-center justify-center text-[0.65rem] font-bold text-foreground shrink-0">
                            {companyInitial(a.company_name)}
                          </div>
                          <span className="text-foreground">{a.company_name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {a.portal ? (
                          <Badge variant="secondary" className="text-[0.68rem] px-2 py-0.5">
                            {a.portal}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium">
                        {a.keyword_score != null ? `${a.keyword_score}%` : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[0.68rem] font-medium border ${statusBadge(a.status)}`}>
                          <span className="size-1.5 rounded-full bg-current" />
                          {a.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {a.resume_path && (
                            <span className="px-1.5 py-0.5 rounded bg-muted border border-border text-[0.65rem] text-muted-foreground">
                              <FormattedMessage id="applications.file.resume" defaultMessage="resume" />
                            </span>
                          )}
                          {a.cover_letter_path && (
                            <span className="px-1.5 py-0.5 rounded bg-muted border border-border text-[0.65rem] text-muted-foreground">
                              <FormattedMessage id="applications.file.cover" defaultMessage="cover" />
                            </span>
                          )}
                          {a.report_path && (
                            <span className="px-1.5 py-0.5 rounded bg-muted border border-border text-[0.65rem] text-muted-foreground">
                              <FormattedMessage id="applications.file.report" defaultMessage="report" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pager footer */}
            <div className="border-t border-border px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                <FormattedMessage
                  id="applications.pager"
                  defaultMessage="Showing {count} of {total}"
                  values={{ count: list.length, total: list.length }}
                />
              </span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="icon-xs" disabled>
                  <CaretLeftIcon className="size-3" />
                </Button>
                <span className="px-2 py-0.5 rounded bg-muted border border-border font-medium text-foreground text-[0.7rem]">
                  1
                </span>
                <Button variant="outline" size="icon-xs" disabled>
                  <CaretRightIcon className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

