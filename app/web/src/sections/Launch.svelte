<script>
  import { api, post, subscribe } from "../api.js";

  let providers = $state([]);
  let provider = $state("opencode");
  let model = $state("");
  let running = $state(false);
  let log = $state([]); // { kind, text }

  // skill param inputs
  let skill = $state("job-scout");
  let query = $state("");
  let location = $state("São Paulo");
  let company = $state("");
  let jobIds = $state("");

  $effect(() => {
    api("acp/providers").then((p) => {
      providers = p.providers;
      provider = p.default;
    }).catch(() => {});

    const unsub = subscribe((msg) => {
      switch (msg.type) {
        case "acp-status":
          if (msg.status === "starting") { running = true; push("status", `▶ starting ${msg.skill} via ${msg.provider}`); }
          else if (msg.status === "running") push("status", `● running ${msg.skill}`);
          else if (msg.status === "done") { running = false; push("status", `✓ ${msg.skill} finished`); }
          break;
        case "acp-update": {
          const u = msg.update?.update;
          const k = u?.sessionUpdate;
          if (k === "agent_message_chunk" && u.content?.text) push("msg", u.content.text, true);
          else if (k === "tool_call") push("tool", `🔧 ${u.title ?? u.kind ?? "tool"}`);
          else if (k === "tool_call_update" && u.status) push("tool", `   ${u.status}`);
          else if (k === "plan") push("plan", `📋 plan updated`);
          break;
        }
        case "acp-permission":
          push("perm", `🔐 auto-approved a permission request`);
          break;
        case "acp-log":
          break; // keep noise out of the stream
        case "acp-error":
          running = false; push("err", `✗ ${msg.message}`);
          break;
        case "acp-exit":
          running = false; break;
      }
    });
    return unsub;
  });

  // reset model when provider changes and current model isn't in new provider's list
  let prevProvider;
  $effect(() => {
    const prev = prevProvider;
    prevProvider = provider;
    if (prev === provider) return;
    const cur = providers.find((p) => p.id === provider);
    if (!cur || !cur.models || !cur.models.length) { model = ""; return; }
    if (!model || !cur.models.includes(model)) model = cur.models[0];
  });

  function push(kind, text, append = false) {
    if (append && log.length && log[log.length - 1].kind === "msg") {
      log[log.length - 1] = { kind, text: log[log.length - 1].text + text };
      log = [...log];
    } else {
      log = [...log, { kind, text }];
    }
  }

  async function launch() {
    log = [];
    const params = { query, location, company, jobIds };
    const selectedProvider = providers.find((p) => p.id === provider);
    const selectedModel = selectedProvider?.models?.includes(model) ? model : "";
    try {
      await post("acp/run", { provider, model: selectedModel, skill, params });
    } catch (e) {
      push("err", e.message);
    }
  }

  async function cancel() {
    try { await post("acp/cancel", {}); } catch {}
  }

  const skills = [
    { id: "job-scout", label: "Job Scout" },
    { id: "experience-bank", label: "Experience Bank (grill me)" },
    { id: "recruiter-outreach", label: "Recruiter Outreach" },
    { id: "profile-optimizer", label: "Profile Optimizer" },
    { id: "resume-tailor", label: "Resume Tailor" },
  ];
</script>

<h1 class="page-title">Launch</h1>
<p class="page-sub">Run a Mercury skill through your agent — live</p>

<div class="panel">
  <div class="row">
    <label>Agent
      <select bind:value={provider}>
        {#each providers as p}<option value={p.id}>{p.displayName}</option>{/each}
      </select>
    </label>
    <label>Model
      <select bind:value={model} disabled={(providers.find(p => p.id === provider)?.models ?? []).length === 0}>
        {#each (providers.find(p => p.id === provider)?.models ?? []) as m}
          <option value={m}>{m}</option>
        {/each}
      </select>
    </label>
    <label>Skill
      <select bind:value={skill}>
        {#each skills as s}<option value={s.id}>{s.label}</option>{/each}
      </select>
    </label>
  </div>

  <div class="row" style="margin-top:12px">
    {#if skill === "job-scout"}
      <label>Query<input bind:value={query} placeholder="backend engineer" /></label>
      <label>Location<input bind:value={location} /></label>
    {:else if skill === "recruiter-outreach"}
      <label>Company<input bind:value={company} placeholder="Airbnb" /></label>
      <label>Location<input bind:value={location} /></label>
    {:else if skill === "resume-tailor"}
      <label>Job IDs (comma-sep)<input bind:value={jobIds} placeholder="4393940374, 3969556398" /></label>
    {:else if skill === "profile-optimizer"}
      <span class="dim" style="font-size:.85rem;align-self:center">No parameters — audits your profile.</span>
    {:else if skill === "experience-bank"}
      <span class="dim" style="font-size:.85rem;align-self:center">No parameters — interviews you about new achievements (interactive).</span>
    {/if}
  </div>

  <div style="margin-top:14px;display:flex;gap:10px">
    <button class="go" onclick={launch} disabled={running || (providers.find(p => p.id === provider)?.models ?? []).length === 0}>{running ? "Running…" : "Launch"}</button>
    {#if running}<button class="cancel" onclick={cancel}>Cancel</button>{/if}
  </div>
</div>

<div class="panel">
  <h3>Agent stream {#if running}<span class="live-dot"></span>{/if}</h3>
  {#if log.length === 0}
    <div class="empty">No run yet. Pick a skill and hit Launch.</div>
  {:else}
    <div class="stream">
      {#each log as entry}
        <div class="line {entry.kind}">{entry.text}</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
  label { display:flex; flex-direction:column; gap:6px; font-size:.78rem; color:var(--dim); }
  input, select {
    background:var(--panel-2); border:1px solid var(--border-2); border-radius:8px;
    padding:9px 11px; color:var(--text); font-size:.9rem;
  }
  input:focus, select:focus { outline:none; border-color:var(--blue); }
  .go { background:linear-gradient(135deg,var(--blue),var(--cyan)); color:white; border:none; padding:9px 20px; border-radius:8px; cursor:pointer; font-weight:600; }
  .go:disabled { opacity:.5; cursor:not-allowed; }
  .cancel { background:transparent; color:var(--red); border:1px solid var(--red); padding:9px 16px; border-radius:8px; cursor:pointer; }
  .stream { background:var(--panel-2); border:1px solid var(--border); border-radius:8px; padding:14px; max-height:460px; overflow:auto; font-family:ui-monospace,monospace; font-size:.82rem; }
  .line { padding:1px 0; white-space:pre-wrap; line-height:1.5; }
  .line.msg { color:var(--text); }
  .line.tool { color:var(--cyan); }
  .line.status { color:var(--green); }
  .line.plan { color:var(--purple); }
  .line.perm { color:var(--amber); }
  .line.err { color:var(--red); }
</style>
