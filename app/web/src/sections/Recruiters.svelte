<script>
  import { api, post } from "../api.js";
  import { resource } from "../lib/resource.svelte.js";
  import { useLiveTable } from "../lib/live.svelte.js";
  import LoadingState from "../lib/LoadingState.svelte";
  import ErrorState from "../lib/ErrorState.svelte";
  import EmptyState from "../lib/EmptyState.svelte";
  import { MapPin, RefreshCw, Clock } from "@lucide/svelte";

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

  const due = resource(() => api("recruiters/due"), []);
  useLiveTable("recruiters", due.reload);

  let byStatus = $derived(
    COLS.reduce((acc, c) => {
      acc[c] = (recruiters.data ?? []).filter((r) => r.status === c);
      return acc;
    }, {})
  );

  // ── Sync: detect accepted invitations via LinkedIn (issue #15) ──────────
  let syncing = $state(false);
  let syncMsg = $state(null); // { ok: bool, text: string }

  async function runSync() {
    if (syncing) return;
    syncing = true;
    syncMsg = null;
    try {
      const r = await post("recruiters/sync", { apply: true });
      const n = r.changes?.length ?? 0;
      syncMsg = {
        ok: true,
        text:
          n === 0
            ? `No new acceptances (scanned ${r.scanned} pending across ${r.companiesQueried}).`
            : `${n} newly accepted: ${r.changes.map((c) => c.name).join(", ")}`,
      };
      if (r.skipped?.length) syncMsg.text += ` · skipped: ${r.skipped.join(", ")}`;
      // recruiters table broadcasts on change; reload due list explicitly.
      due.reload();
    } catch (e) {
      syncMsg = { ok: false, text: e.message ?? "Sync failed (is LinkedIn reachable?)" };
    } finally {
      syncing = false;
    }
  }
</script>

<div class="flex items-start justify-between gap-4">
  <div>
    <h1 class="page-title">Recruiters</h1>
    <p class="page-sub">
      {recruiters.status === "ready" ? recruiters.data.length : "—"} contacts across your outreach pipeline
    </p>
  </div>
  <button class="sync-btn" onclick={runSync} disabled={syncing} title="Detect which pending invites are now accepted (1st-degree on LinkedIn)">
    <RefreshCw size={14} class={syncing ? "spin" : ""} />
    {syncing ? "Syncing…" : "Sync now"}
  </button>
</div>

{#if syncMsg}
  <div class="sync-msg {syncMsg.ok ? 'ok' : 'err'}">{syncMsg.text}</div>
{/if}

{#if (due.data ?? []).length > 0}
  <div class="due-panel">
    <h4><Clock size={13} /> Due follow-ups</h4>
    {#each due.data as d}
      <div class="due-row">
        <span class="due-action">{d.action}</span>
        <span class="due-who">
          {#if d.username}<a href={`https://www.linkedin.com/in/${d.username}/`} target="_blank">{d.name}</a>{:else}{d.name}{/if}
          <span class="text-faint">· {d.company}</span>
        </span>
        <span class="due-reason">{d.reason}</span>
      </div>
    {/each}
  </div>
{/if}

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
  /* Sync button + result banner */
  .sync-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.8rem;
    font-size: 0.8rem;
    font-weight: 510;
    color: var(--color-text);
    background: var(--color-panel-2);
    border: 1px solid var(--color-border);
    border-radius: 7px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.12s, border-color 0.12s;
  }
  .sync-btn:hover:not(:disabled) {
    background: rgba(94, 106, 210, 0.12);
    border-color: #5e6ad2;
  }
  .sync-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  :global(.sync-btn .spin) {
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .sync-msg {
    margin: 0.75rem 0 0;
    padding: 0.5rem 0.75rem;
    border-radius: 7px;
    font-size: 0.8rem;
    border: 1px solid var(--color-border-2);
  }
  .sync-msg.ok {
    background: rgba(16, 185, 129, 0.08);
    border-color: rgba(16, 185, 129, 0.35);
    color: #34d399;
  }
  .sync-msg.err {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.35);
    color: #f87171;
  }

  /* Due follow-ups panel */
  .due-panel {
    margin: 1rem 0 0;
    padding: 0.75rem 1rem;
    background: var(--color-panel);
    border: 1px solid var(--color-border-2);
    border-radius: 10px;
  }
  .due-panel h4 {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-dim);
    margin: 0 0 0.5rem;
  }
  .due-row {
    display: grid;
    grid-template-columns: auto 1fr 2fr;
    gap: 0.75rem;
    align-items: baseline;
    padding: 0.3rem 0;
    font-size: 0.8rem;
    border-top: 1px solid var(--color-border-2);
  }
  .due-action {
    text-transform: uppercase;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: #fbbf24;
  }
  .due-reason {
    color: var(--color-dim);
  }

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
