<script>
  import { api } from "../api.js";
  import { resource } from "../lib/resource.svelte.js";
  import { useLiveTable } from "../lib/live.svelte.js";
  import LoadingState from "../lib/LoadingState.svelte";
  import ErrorState from "../lib/ErrorState.svelte";
  import EmptyState from "../lib/EmptyState.svelte";
  import { MapPin } from "@lucide/svelte";

  const COLS = ["pending", "accepted", "replied", "interviewing", "closed"];

  // Per-column accent bar color (left edge of each card). Interviewing is the
  // highlighted "active" column.
  const ACCENT = {
    pending: "#3e3e44",
    accepted: "#10b981",
    replied: "#5e6ad2",
    interviewing: "#10b981",
    closed: "#3e3e44",
  };

  const recruiters = resource(() => api("recruiters"), []);
  useLiveTable("recruiters", recruiters.reload);

  let byStatus = $derived(
    COLS.reduce((acc, c) => {
      acc[c] = (recruiters.data ?? []).filter((r) => r.status === c);
      return acc;
    }, {})
  );
</script>

<h1 class="page-title">Recruiters</h1>
<p class="page-sub">
  {recruiters.status === "ready" ? recruiters.data.length : "—"} contacts across your outreach pipeline
</p>

{#if recruiters.status === "loading"}
  <LoadingState rows={5} />
{:else if recruiters.status === "error"}
  <ErrorState error={recruiters.error} onretry={recruiters.reload} />
{:else if recruiters.data.length === 0}
  <EmptyState message="No recruiters yet." skill="recruiter-outreach" />
{:else}
  <div class="kanban">
    {#each COLS as col}
      {@const highlighted = col === "interviewing"}
      <div class="kanban-col {highlighted ? 'is-active' : ''}">
        <h4>
          <span class="flex items-center gap-2">
            {#if highlighted}<span class="w-2 h-2 rounded-full bg-green" style="box-shadow: 0 0 8px rgba(16,185,129,.5);"></span>{/if}
            {col}
          </span>
          <span class="count">{byStatus[col].length}</span>
        </h4>
        <div class="flex-1 overflow-y-auto space-y-2 pr-1">
          {#each byStatus[col] as r}
            <div class="kanban-card">
              <span class="accent" style:background={ACCENT[col]} style:box-shadow={highlighted || col === "replied" ? `0 0 8px ${ACCENT[col]}` : "none"}></span>
              <div class="n">
                {#if r.username}<a href={`https://www.linkedin.com/in/${r.username}/`} target="_blank">{r.name}</a>{:else}{r.name}{/if}
              </div>
              {#if r.company || r.title}<div class="c">{r.company ?? ""}{r.title ? ` · ${r.title}` : ""}</div>{/if}
              {#if r.location || r.degree}
                <div class="c flex items-center gap-1">
                  <MapPin size={12} class="text-faint" />
                  {r.location ?? ""}{r.degree ? ` · ${r.degree}` : ""}
                </div>
              {/if}
              {#if r.note}
                <div class="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-white/[0.03] border border-border-2 text-[0.7rem] text-dim">
                  {r.note}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  /* Highlighted (active) Interviewing column: solid elevated surface + top glow. */
  .kanban-col.is-active {
    background: var(--color-panel-2);
    border-color: var(--color-border);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
    position: relative;
  }
  .kanban-col.is-active::before {
    content: "";
    position: absolute;
    top: 0;
    left: 25%;
    right: 25%;
    height: 1px;
    background: linear-gradient(to right, transparent, #7170ff, transparent);
    opacity: 0.5;
    filter: blur(1px);
  }
</style>
