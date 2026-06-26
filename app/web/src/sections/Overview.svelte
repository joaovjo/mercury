<script>
  let { overview, rev, onnav } = $props();

  function pillClass(value) {
    const v = String(value).toLowerCase();
    if (["true", "strong", "good", "ok", "yes", "done", "set"].some((s) => v.includes(s))) return "good";
    if (["weak", "missing", "empty", "none", "no", "false", "todo"].some((s) => v.includes(s))) return "bad";
    return "neutral";
  }
  let breakdown = $derived(overview?.breakdown ?? []);
</script>

<h1 class="page-title">Overview</h1>
<p class="page-sub">Your job search at a glance</p>

{#if overview}
  <div class="cards">
    <div class="card" role="button" tabindex="0" onclick={() => onnav("profile")}>
      <div class="label">Profile Score</div>
      <div class="value grad">{overview.score ?? "—"}</div>
    </div>
    <div class="card" role="button" tabindex="0" onclick={() => onnav("recruiters")}>
      <div class="label">Recruiters</div>
      <div class="value">{overview.recruiters}</div>
    </div>
    <div class="card">
      <div class="label">Accepted</div>
      <div class="value" style="color:var(--green)">{overview.accepted}</div>
    </div>
    <div class="card">
      <div class="label">Replied</div>
      <div class="value" style="color:var(--cyan)">{overview.replied}</div>
    </div>
    <div class="card" role="button" tabindex="0" onclick={() => onnav("interviews")}>
      <div class="label">Interviews</div>
      <div class="value" style="color:var(--purple)">{overview.interviews}</div>
    </div>
    <div class="card" role="button" tabindex="0" onclick={() => onnav("jobs")}>
      <div class="label">Jobs Saved</div>
      <div class="value">{overview.jobs}</div>
    </div>
  </div>

  {#if breakdown.length}
    <div class="panel">
      <h3>Profile breakdown
        <span class="dim" style="font-size:.78rem;font-weight:400">· <a href={"#"} onclick={(e) => { e.preventDefault(); onnav("profile"); }}>view details →</a></span>
      </h3>
      <div class="bd-grid">
        {#each breakdown as item}
          <div class="bd-row">
            <span class="bd-label">{item.label}</span>
            {#if item.value}<span class="pill {pillClass(item.value)}">{item.value}</span>{/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="panel">
    <h3>Pipeline health</h3>
    <p class="muted" style="font-size:.9rem;line-height:1.6">
      {overview.recruiters} recruiters contacted · {overview.accepted} accepted ·
      {overview.replied} replied · {overview.interviews} interviews scheduled.
      {#if overview.score === null}
        <br />Go to <a href={"#"} onclick={(e) => { e.preventDefault(); onnav("profile"); }}>Profile</a> and click <strong>Scan profile</strong> to capture your first score + breakdown.
      {/if}
    </p>
  </div>
{:else}
  <div class="empty">Loading…</div>
{/if}

<style>
  .bd-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:8px; }
  .bd-row {
    display:flex; align-items:center; justify-content:space-between; gap:10px;
    background:var(--panel-2); border:1px solid var(--border); border-radius:8px; padding:8px 11px;
  }
  .bd-label { font-size:.82rem; text-transform:capitalize; }
  .pill { padding:2px 9px; border-radius:999px; font-size:.71rem; font-weight:600; }
  .pill.good { background:rgba(34,197,94,.15); color:var(--green); }
  .pill.bad { background:rgba(239,68,68,.15); color:var(--red); }
  .pill.neutral { background:#27272a; color:var(--muted); }
</style>
