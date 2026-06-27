<script>
  import { api } from "../api.js";
  import { resource } from "../lib/resource.svelte.js";
  import { useLiveTable } from "../lib/live.svelte.js";
  import LoadingState from "../lib/LoadingState.svelte";
  import ErrorState from "../lib/ErrorState.svelte";
  import EmptyState from "../lib/EmptyState.svelte";
  import {
    Plus, ListFilter, LinkIcon, ChevronLeft, ChevronRight,
  } from "@lucide/svelte";

  const apps = resource(() => api("applications"), []);
  useLiveTable("applications", apps.reload);

  // Some applications aren't linked to a scouted job (job_id is null) — e.g.
  // resume-tailor produced files for a target that was never saved to the jobs
  // table. Fall back to a readable label derived from the artifact filename so
  // the row isn't blank.
  function derivedLabel(a) {
    if (a.job_title) return a.job_title;
    const path = a.resume_path || a.cover_letter_path || a.report_path;
    if (!path) return "—";
    const base = path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
    if (!base) return "—";
    return base.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function companyInitial(name) {
    return (name ?? "—").trim().charAt(0).toUpperCase() || "—";
  }
</script>

<h1 class="page-title">Applications</h1>
<p class="page-sub">Tailored resumes &amp; cover letters</p>

{#if apps.status === "loading"}
  <LoadingState />
{:else if apps.status === "error"}
  <ErrorState error={apps.error} onretry={apps.reload} />
{:else if apps.data.length === 0}
  <EmptyState message="No applications yet." skill="resume-tailor" />
{:else}
  <!-- Toolbar (Filter / New are visual shells — wired in a later pass) -->
  <div class="flex items-center justify-between mb-4 pb-4 border-b border-border-2 text-[0.8rem] font-[510] text-dim">
    <div class="flex items-center gap-2">
      <span>{apps.data.length} Applications</span>
      <span class="text-white/20">•</span>
      <button class="hover:text-text transition-colors flex items-center gap-1" title="Filtering coming soon" disabled>
        Filter <ListFilter size={14} />
      </button>
    </div>
    <button class="btn-primary !px-3 !py-1.5 text-[0.75rem]" title="Manual entry coming soon" disabled>
      <Plus size={14} /> New Application
    </button>
  </div>

  <!-- Table -->
  <div class="bg-panel-2 rounded-xl border border-border overflow-hidden" style="box-shadow: rgba(0,0,0,0.2) 0 0 0 1px;">
    <div class="overflow-x-auto">
      <table>
        <thead>
          <tr class="bg-black/20">
            <th class="w-[25%]">Role / Target</th>
            <th>Company</th>
            <th>Portal</th>
            <th>Score</th>
            <th>Status</th>
            <th class="text-right">Files</th>
          </tr>
        </thead>
        <tbody>
          {#each apps.data as a}
            <tr class="group hover:bg-white/[0.02] transition-colors">
              <td>
                <div class="flex items-center gap-2">
                  {#if a.external_url}
                    <a href={a.external_url} target="_blank" rel="noreferrer" class="text-text font-[510] group-hover:text-cyan transition-colors truncate">{derivedLabel(a)}</a>
                  {:else}
                    <span class="text-text font-[510] truncate">{derivedLabel(a)}</span>
                  {/if}
                  {#if !a.job_id}
                    <span class="text-[0.62rem] text-faint flex items-center gap-0.5 bg-white/5 px-1.5 py-0.5 rounded-sm shrink-0" title="Not linked to a scouted job">
                      <LinkIcon size={10} /> unlinked
                    </span>
                  {/if}
                </div>
              </td>
              <td>
                <div class="flex items-center gap-2">
                  <div class="w-5 h-5 rounded shrink-0 bg-white/5 border border-border flex items-center justify-center text-[0.6rem] font-bold text-white/50">{companyInitial(a.company_name)}</div>
                  <span>{a.company_name ?? "—"}</span>
                </div>
              </td>
              <td>
                {#if a.portal}
                  <span class="px-2 py-0.5 rounded bg-white/[0.05] border border-border-2 text-[0.68rem] font-[510] text-dim">{a.portal}</span>
                {:else}<span class="text-faint">—</span>{/if}
              </td>
              <td class="font-mono text-[0.8rem] text-text">{a.keyword_score != null ? `${a.keyword_score}%` : "—"}</td>
              <td><span class="pill {a.status}"><span class="dot"></span>{a.status.replace("_", " ")}</span></td>
              <td class="text-right">
                <div class="flex items-center justify-end gap-1 flex-wrap">
                  {#if a.resume_path}<span class="px-1.5 py-0.5 rounded-sm bg-white/[0.03] border border-white/[0.03] text-[0.62rem] text-faint">resume</span>{/if}
                  {#if a.cover_letter_path}<span class="px-1.5 py-0.5 rounded-sm bg-white/[0.03] border border-white/[0.03] text-[0.62rem] text-faint">cover</span>{/if}
                  {#if a.report_path}<span class="px-1.5 py-0.5 rounded-sm bg-white/[0.03] border border-white/[0.03] text-[0.62rem] text-faint">report</span>{/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <!-- Pager (visual shell — single page for now) -->
    <div class="border-t border-border-2 px-4 py-3 flex items-center justify-between text-[0.8rem] text-dim">
      <span>Showing {apps.data.length} of {apps.data.length}</span>
      <div class="flex items-center gap-2">
        <button class="w-7 h-7 rounded border border-border flex items-center justify-center opacity-50" disabled><ChevronLeft size={16} /></button>
        <button class="w-7 h-7 rounded border border-border flex items-center justify-center text-text bg-white/[0.05]">1</button>
        <button class="w-7 h-7 rounded border border-border flex items-center justify-center opacity-50" disabled><ChevronRight size={16} /></button>
      </div>
    </div>
  </div>
{/if}
