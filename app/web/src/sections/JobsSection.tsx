import { ArrowSquareOutIcon, BriefcaseIcon } from "@phosphor-icons/react";
import { useResource } from "@/hooks/useResource";
import { useLiveTable } from "@/hooks/useLiveTable";
import { api } from "@/lib/api";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import type { Job } from "@/types";

function fitVariant(fit?: string): "default" | "destructive" | "secondary" {
  if (!fit) return "secondary";
  const f = fit.toLowerCase();
  if (f === "strong" || f === "good") return "default";
  if (f === "stretch") return "secondary";
  if (f === "bad") return "destructive";
  return "secondary";
}

export function JobsSection() {
  const jobs = useResource<Job[]>(() => api<Job[]>("jobs"), []);
  useLiveTable("jobs", jobs.reload);

  const list = jobs.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {jobs.status === "ready" ? `${list.length} scouted roles` : "—"} · search coming in Phase 2
        </p>
      </div>

      {jobs.status === "loading" && <LoadingState rows={5} />}
      {jobs.status === "error" && <ErrorState error={jobs.error} onretry={jobs.reload} />}
      {jobs.status === "ready" && list.length === 0 && (
        <EmptyState message="No jobs saved yet." skill="job-scout" />
      )}

      {jobs.status === "ready" && list.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Fit</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {list.map((j, idx) => (
                  <tr key={j.id ?? idx} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-semibold text-foreground">{j.title ?? "—"}</td>
                    <td className="py-3 px-4 text-foreground">{j.company_name ?? "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground">{j.work_type ?? "—"}</td>
                    <td className="py-3 px-4">
                      {j.fit ? (
                        <Badge variant={fitVariant(j.fit)} className="capitalize text-[0.68rem] px-2 py-0.5">
                          {j.fit}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{j.status}</td>
                    <td className="py-3 px-4 text-right">
                      {j.link ? (
                        <a
                          href={j.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          view <ArrowSquareOutIcon className="size-3" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
