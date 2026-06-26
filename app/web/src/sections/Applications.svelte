<script>
  import { api } from "../api.js";
  import { resource } from "../lib/resource.svelte.js";
  import { useLiveTable } from "../lib/live.svelte.js";
  import LoadingState from "../lib/LoadingState.svelte";
  import ErrorState from "../lib/ErrorState.svelte";
  import EmptyState from "../lib/EmptyState.svelte";

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
</script>

<h1 class="page-title">Applications</h1>
<p class="page-sub">
  {apps.status === "ready" ? apps.data.length : "—"} tailored resumes &amp; cover letters
</p>

{#if apps.status === "loading"}
  <LoadingState />
{:else if apps.status === "error"}
  <ErrorState error={apps.error} onretry={apps.reload} />
{:else if apps.data.length === 0}
  <EmptyState message="No applications yet." skill="resume-tailor" />
{:else}
  <div class="panel">
    <table>
      <thead><tr><th>Role / Target</th><th>Company</th><th>Portal</th><th>Score</th><th>Status</th><th>Files</th></tr></thead>
      <tbody>
        {#each apps.data as a}
          <tr>
            <td>
              {#if a.external_url}
                <a href={a.external_url} target="_blank" rel="noreferrer" class="text-cyan hover:underline">{derivedLabel(a)}</a>
              {:else}
                {derivedLabel(a)}
              {/if}
              {#if !a.job_id}<span class="dim text-[0.72rem]" title="Not linked to a scouted job">· unlinked</span>{/if}
            </td>
            <td>{a.company_name ?? "—"}</td>
            <td>{#if a.portal}<span class="pill neutral">{a.portal}</span>{:else}<span class="dim">—</span>{/if}</td>
            <td>{a.keyword_score != null ? `${a.keyword_score}%` : "—"}</td>
            <td><span class="pill {a.status}">{a.status.replace("_", " ")}</span></td>
            <td class="dim text-[0.78rem]">
              {#if a.resume_path}resume {/if}{#if a.cover_letter_path}· cover {/if}{#if a.report_path}· report{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
