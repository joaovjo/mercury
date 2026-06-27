<script>
  import { api, post, subscribe } from "../api.js";
  import { Play, X, Settings2, Terminal } from "@lucide/svelte";
  import Select from "../lib/Select.svelte";

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
    if (model && !cur.models.includes(model)) model = "";
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
    const selectedModel = selectedProvider?.models?.includes(model) ? model : undefined;
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

  // Bits UI Select item lists ({value,label}).
  let providerItems = $derived(providers.map((p) => ({ value: p.id, label: p.displayName })));
  let modelItems = $derived([
    { value: "", label: "Default" },
    ...(providers.find((p) => p.id === provider)?.models ?? []).map((m) => ({ value: m, label: m })),
  ]);
  const skillItems = skills.map((s) => ({ value: s.id, label: s.label }));
</script>

<h1 class="page-title">Launch</h1>
<p class="page-sub">Run a Mercury skill through your agent — live</p>

<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
  <!-- Configuration panel -->
  <div class="lg:col-span-5 flex flex-col bg-panel border border-border-2 rounded-xl overflow-hidden" style="box-shadow: 0 0 0 1px rgba(0,0,0,0.2);">
    <div class="px-5 py-4 border-b border-border-2 bg-white/[0.01]">
      <h2 class="text-[0.85rem] font-[590] text-muted tracking-[-0.182px] flex items-center gap-2">
        <Settings2 size={16} class="text-dim" /> Configuration
      </h2>
    </div>
    <div class="p-5 flex-1 overflow-y-auto space-y-5">
      <label class="field-label">Agent
        <Select items={providerItems} bind:value={provider} placeholder="Agent" ariaLabel="Agent" />
      </label>
      <label class="field-label">Model
        <Select items={modelItems} bind:value={model} placeholder="Default" ariaLabel="Model" />
      </label>
      <label class="field-label">Skill
        <Select items={skillItems} bind:value={skill} placeholder="Skill" ariaLabel="Skill" />
      </label>

      <!-- Skill-specific params -->
      <div class="space-y-5 pt-1">
        {#if skill === "job-scout"}
          <label class="field-label">Query<input class="input normal-case font-normal" bind:value={query} placeholder="backend engineer" /></label>
          <label class="field-label">Location<input class="input normal-case font-normal" bind:value={location} /></label>
        {:else if skill === "recruiter-outreach"}
          <label class="field-label">Company<input class="input normal-case font-normal" bind:value={company} placeholder="Airbnb" /></label>
          <label class="field-label">Location<input class="input normal-case font-normal" bind:value={location} /></label>
        {:else if skill === "resume-tailor"}
          <label class="field-label">Job IDs (comma-sep)<input class="input normal-case font-normal" bind:value={jobIds} placeholder="4393940374, 3969556398" /></label>
        {:else if skill === "profile-optimizer"}
          <p class="text-[0.85rem] text-dim normal-case font-normal">No parameters — audits your profile.</p>
        {:else if skill === "experience-bank"}
          <p class="text-[0.85rem] text-dim normal-case font-normal">No parameters — interviews you about new achievements (interactive).</p>
        {/if}
      </div>
    </div>
    <div class="p-5 border-t border-border-2">
      {#if running}
        <button class="btn-danger w-full" onclick={cancel}><X size={16} /> Cancel</button>
      {:else}
        <button class="btn-primary w-full" onclick={launch}><Play size={16} /> Run Agent</button>
      {/if}
    </div>
  </div>

  <!-- Live agent stream / terminal -->
  <div class="lg:col-span-7 flex flex-col bg-[#050505] border border-border rounded-xl overflow-hidden" style="box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
    <div class="px-5 py-3 border-b border-border-2 bg-[#0a0a0b] flex items-center justify-between">
      <h2 class="text-[0.8rem] font-mono text-dim flex items-center gap-2">
        <Terminal size={14} /> agent_output.log
      </h2>
      {#if running}
        <div class="flex items-center gap-2">
          <span class="text-[0.68rem] font-[510] text-green uppercase tracking-wider">Active</span>
          <span class="relative w-2 h-2 rounded-full bg-green">
            <span class="absolute inset-0 rounded-full bg-green" style="animation: pulse-ring 2s cubic-bezier(0.215,0.61,0.355,1) infinite; z-index:-1;"></span>
          </span>
        </div>
      {/if}
    </div>
    <div class="p-5 flex-1 overflow-y-auto font-mono text-[0.8rem] leading-[1.6] min-h-[280px]">
      {#if log.length === 0}
        <div class="text-faint">No run yet. Pick a skill and hit Run Agent.</div>
      {:else}
        {#each log as entry}
          <div class="stream-line {entry.kind}">{entry.text}</div>
        {/each}
        {#if running}
          <div class="inline-block w-2 h-4 bg-text opacity-70 animate-pulse translate-y-1 mt-1"></div>
        {/if}
      {/if}
    </div>
  </div>
</div>
