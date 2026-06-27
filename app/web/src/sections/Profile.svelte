<script>
  import { api, post, subscribe } from "../api.js";
  import { resource } from "../lib/resource.svelte.js";
  import { useLiveTable } from "../lib/live.svelte.js";
  import LoadingState from "../lib/LoadingState.svelte";
  import ErrorState from "../lib/ErrorState.svelte";
  import uPlot from "uplot";
  import "uplot/dist/uPlot.min.css";

  // Combined data resource: metrics (trend) + snapshot (cards/breakdown).
  const data = resource(
    async () => {
      const [metrics, snapshot] = await Promise.all([
        api("metrics"),
        api("profile-snapshot"),
      ]);
      return { metrics, snapshot };
    },
    { metrics: [], snapshot: null }
  );
  useLiveTable("profile_metrics", data.reload);

  let chartEl = $state();
  let plot;

  // scan state
  let scanning = $state(false);
  let scanLog = $state([]);
  let provider = $state("opencode");

  $effect(() => {
    api("acp/providers").then((p) => (provider = p.default)).catch(() => {});
    const unsub = subscribe((msg) => {
      switch (msg.type) {
        case "acp-status":
          if (msg.skill !== "profile-optimizer") return;
          if (msg.status === "starting") { scanning = true; scanLog = ["▶ starting profile scan…"]; }
          else if (msg.status === "running") scanLog = [...scanLog, "● scanning your profile"];
          else if (msg.status === "done") { scanning = false; scanLog = [...scanLog, "✓ scan complete"]; data.reload(); }
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
      }
    });
    return unsub;
  });

  let metrics = $derived(data.data?.metrics ?? []);
  let snapshot = $derived(data.data?.snapshot ?? null);
  let hasScan = $derived(snapshot?.hasScan);
  let breakdown = $derived(snapshot?.breakdown ?? []);

  $effect(() => {
    if (!chartEl || metrics.length === 0) return;
    const xs = metrics.map((m) => Date.parse(m.captured_at) / 1000);
    const series = (key) => metrics.map((m) => m[key] ?? null);
    const d = [xs, series("profile_views"), series("search_appearances"), series("connections")];
    plot?.destroy();
    plot = new uPlot(
      {
        width: chartEl.clientWidth || 700,
        height: 260,
        scales: { x: { time: true } },
        series: [
          {},
          { label: "Profile Views", stroke: "#7170ff", width: 2 },
          { label: "Search Appearances", stroke: "#5e6ad2", width: 2 },
          { label: "Connections", stroke: "#10b981", width: 2 },
        ],
        axes: [
          { stroke: "#8a8f98", grid: { stroke: "rgba(255,255,255,0.05)" } },
          { stroke: "#8a8f98", grid: { stroke: "rgba(255,255,255,0.05)" } },
        ],
      },
      d,
      chartEl
    );
  });

  async function scan() {
    scanLog = [];
    try {
      await post("acp/run", { provider, skill: "profile-optimizer", params: {} });
    } catch (e) {
      scanLog = [`✗ ${e.message}`];
    }
  }

  function pillClass(value) {
    const v = String(value).toLowerCase();
    if (["true", "strong", "good", "ok", "yes", "done", "set"].some((s) => v.includes(s))) return "good";
    if (["weak", "missing", "empty", "none", "no", "false", "todo"].some((s) => v.includes(s))) return "bad";
    return "neutral";
  }
</script>

<div class="flex items-start justify-between gap-4">
  <div>
    <h1 class="page-title">Profile</h1>
    <p class="page-sub">Recruiter-search visibility + audit breakdown</p>
  </div>
  <button class="btn-success" onclick={scan} disabled={scanning}>
    {scanning ? "Scanning…" : hasScan ? "Re-scan profile" : "Scan profile"}
  </button>
</div>

{#if scanLog.length}
  <div class="panel">
    <h3>Profile scan {#if scanning}<span class="live-dot"></span>{/if}</h3>
    {#each scanLog as line}<div class="font-mono text-[0.8rem] text-muted py-px">{line}</div>{/each}
  </div>
{/if}

{#if data.status === "loading"}
  <LoadingState rows={4} />
{:else if data.status === "error"}
  <ErrorState error={data.error} onretry={data.reload} />
{:else if !hasScan}
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
      <h3>Audit breakdown <span class="dim text-[0.78rem] font-normal">· last scan {new Date(snapshot.capturedAt).toLocaleDateString()}</span></h3>
      <div class="bd-grid">
        {#each breakdown as item}
          <div class="bd-row">
            <span class="bd-label">{item.label}</span>
            {#if item.value}<span class="bd-pill {pillClass(item.value)}">{item.value}</span>{/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="panel">
    <h3>Trend</h3>
    {#if metrics.length === 1}
      <p class="dim text-[0.85rem] mb-3">Only one snapshot so far — the trend line fills in as you re-scan over time.</p>
    {/if}
    <div bind:this={chartEl}></div>
  </div>
{/if}
