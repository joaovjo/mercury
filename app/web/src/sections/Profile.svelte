<script>
  import { api, post, subscribe } from "../api.js";
  import uPlot from "uplot";
  import "uplot/dist/uPlot.min.css";

  let { rev } = $props();
  let metrics = $state([]);
  let snapshot = $state(null);
  let chartEl = $state();
  let plot;

  // scan state
  let scanning = $state(false);
  let scanLog = $state([]);
  let provider = $state("opencode");

  async function load() {
    try {
      [metrics, snapshot] = await Promise.all([api("metrics"), api("profile-snapshot")]);
    } catch {}
  }

  $effect(() => {
    rev;
    load();
  });

  $effect(() => {
    api("acp/providers").then((p) => (provider = p.default)).catch(() => {});
    const unsub = subscribe((msg) => {
      switch (msg.type) {
        case "acp-status":
          if (msg.skill !== "profile-optimizer") return;
          if (msg.status === "starting") { scanning = true; scanLog = ["▶ starting profile scan…"]; }
          else if (msg.status === "running") scanLog = [...scanLog, "● scanning your profile"];
          else if (msg.status === "done") { scanning = false; scanLog = [...scanLog, "✓ scan complete"]; load(); }
          break;
        case "acp-update": {
          if (!scanning) return;
          const u = msg.update?.update;
          const k = u?.sessionUpdate;
          if (k === "tool_call" && (u.title || u.kind)) scanLog = [...scanLog, `🔧 ${u.title ?? u.kind}`];
          break;
        }
        case "acp-error":
          if (scanning) { scanning = false; scanLog = [...scanLog, `✗ ${msg.message}`]; }
          break;
        case "acp-exit":
          scanning = false;
          break;
        case "changed":
          if (msg.table === "profile_metrics") load();
          break;
      }
    });
    return unsub;
  });

  $effect(() => {
    if (!chartEl || metrics.length === 0) return;
    const xs = metrics.map((m) => Date.parse(m.captured_at) / 1000);
    const series = (key) => metrics.map((m) => m[key] ?? null);
    const data = [xs, series("profile_views"), series("search_appearances"), series("connections")];
    plot?.destroy();
    plot = new uPlot(
      {
        width: chartEl.clientWidth || 700,
        height: 260,
        scales: { x: { time: true } },
        series: [
          {},
          { label: "Profile Views", stroke: "#6dd5ed", width: 2 },
          { label: "Search Appearances", stroke: "#0077b5", width: 2 },
          { label: "Connections", stroke: "#a855f7", width: 2 },
        ],
        axes: [
          { stroke: "#71717a", grid: { stroke: "#1f1f26" } },
          { stroke: "#71717a", grid: { stroke: "#1f1f26" } },
        ],
      },
      data,
      chartEl
    );
  });

  let hasScan = $derived(snapshot?.hasScan);
  let breakdown = $derived(snapshot?.breakdown ?? []);

  async function scan() {
    scanLog = [];
    try {
      await post("acp/run", { provider, skill: "profile-optimizer", params: {} });
    } catch (e) {
      scanLog = [`✗ ${e.message}`];
    }
  }

  // map a breakdown value to a status pill class
  function pillClass(value) {
    const v = String(value).toLowerCase();
    if (["true", "strong", "good", "ok", "yes", "done", "set"].some((s) => v.includes(s))) return "good";
    if (["weak", "missing", "empty", "none", "no", "false", "todo"].some((s) => v.includes(s))) return "bad";
    return "neutral";
  }
</script>

<div style="display:flex;align-items:start;justify-content:space-between;gap:16px">
  <div>
    <h1 class="page-title">Profile</h1>
    <p class="page-sub">Recruiter-search visibility + audit breakdown</p>
  </div>
  <button class="scan" onclick={scan} disabled={scanning}>
    {scanning ? "Scanning…" : hasScan ? "Re-scan profile" : "Scan profile"}
  </button>
</div>

{#if scanLog.length}
  <div class="panel scanbox">
    <h3>Profile scan {#if scanning}<span class="live-dot"></span>{/if}</h3>
    {#each scanLog as line}<div class="scanline">{line}</div>{/each}
  </div>
{/if}

{#if !hasScan}
  <div class="empty">
    No profile scan yet. Click <strong>Scan profile</strong> to run the
    <code>profile-optimizer</code> skill — it audits your LinkedIn profile, records
    your score + metrics, and produces the breakdown below.
  </div>
{:else}
  <div class="cards">
    <div class="card"><div class="label">Score</div><div class="value grad">{snapshot?.score ?? "—"}</div></div>
    <div class="card"><div class="label">Views</div><div class="value">{snapshot?.profileViews ?? "—"}</div></div>
    <div class="card"><div class="label">Search Appears/wk</div><div class="value">{snapshot?.searchAppearances ?? "—"}</div></div>
    <div class="card"><div class="label">Connections</div><div class="value">{snapshot?.connections ?? "—"}</div></div>
  </div>

  {#if breakdown.length}
    <div class="panel">
      <h3>Audit breakdown <span class="dim" style="font-size:.78rem;font-weight:400">· last scan {new Date(snapshot.capturedAt).toLocaleDateString()}</span></h3>
      <div class="breakdown">
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
    <h3>Trend</h3>
    {#if metrics.length === 1}
      <p class="dim" style="font-size:.85rem;margin-bottom:12px">Only one snapshot so far — the trend line fills in as you re-scan over time.</p>
    {/if}
    <div bind:this={chartEl}></div>
  </div>
{/if}

<style>
  .scan {
    background:linear-gradient(135deg,#22c55e,#4ade80); color:#0a0a0f; border:none;
    padding:9px 18px; border-radius:8px; cursor:pointer; font-weight:700; font-size:.85rem;
    white-space:nowrap; flex-shrink:0;
  }
  .scan:disabled { opacity:.55; cursor:not-allowed; }
  .scanbox .scanline { font-family:ui-monospace,monospace; font-size:.8rem; color:var(--muted); padding:1px 0; }
  .breakdown { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:8px; }
  .bd-row {
    display:flex; align-items:center; justify-content:space-between; gap:10px;
    background:var(--panel-2); border:1px solid var(--border); border-radius:8px; padding:9px 12px;
  }
  .bd-label { font-size:.85rem; text-transform:capitalize; }
  .pill { padding:2px 9px; border-radius:999px; font-size:.72rem; font-weight:600; }
  .pill.good { background:rgba(34,197,94,.15); color:var(--green); }
  .pill.bad { background:rgba(239,68,68,.15); color:var(--red); }
  .pill.neutral { background:#27272a; color:var(--muted); }
</style>
