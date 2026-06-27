<script>
  import LoadingState from "../lib/LoadingState.svelte";
  import ErrorState from "../lib/ErrorState.svelte";
  import {
    Gauge, Users, CheckCircle2, Reply, Video, Bookmark, ScanLine,
  } from "@lucide/svelte";

  let { overview, onnav } = $props();

  function pillClass(value) {
    const v = String(value).toLowerCase();
    if (["true", "strong", "good", "ok", "yes", "done", "set"].some((s) => v.includes(s))) return "good";
    if (["weak", "missing", "empty", "none", "no", "false", "todo"].some((s) => v.includes(s))) return "bad";
    return "neutral";
  }
  let ov = $derived(overview.status === "ready" ? overview.data : null);
  let breakdown = $derived(ov?.breakdown ?? []);
  let score = $derived(ov?.score ?? null);
</script>

<h1 class="page-title">Overview</h1>
<p class="page-sub">Your job search at a glance</p>

{#if overview.status === "loading"}
  <LoadingState rows={4} />
{:else if overview.status === "error"}
  <ErrorState error={overview.error} onretry={overview.reload} />
{:else}
  <!-- Bento grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
    <!-- Profile Score (hero, spans 2×2) -->
    <div
      class="lg:col-span-2 lg:row-span-2 bg-white/[0.02] border border-border-2 rounded-xl p-6 flex flex-col justify-between relative overflow-hidden group hover:bg-white/[0.03] transition-colors cursor-pointer"
      role="button" tabindex="0"
      onclick={() => onnav("profile")}
      onkeydown={(e) => e.key === "Enter" && onnav("profile")}
    >
      <div class="absolute inset-0 bg-gradient-to-br from-[#5e6ad2]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div class="z-10">
        <h3 class="text-[0.95rem] font-[510] text-muted flex items-center gap-2">
          <Gauge size={18} class="text-cyan" /> Profile Score
        </h3>
        <p class="text-[0.82rem] text-dim mt-1">Recruiter-search visibility</p>
      </div>
      <div class="mt-8 z-10 flex items-end gap-2">
        {#if score != null}
          <span class="text-[4.5rem] font-[510] tracking-[-1.584px] text-text leading-none">{score}</span>
          <span class="text-[1.5rem] text-faint font-normal mb-2">/100</span>
        {:else}
          <span class="text-[2rem] font-[510] text-dim leading-none">Not scanned</span>
        {/if}
      </div>
      <div class="w-full h-1 bg-white/[0.05] rounded-full mt-6 overflow-hidden z-10">
        <div class="h-full bg-blue rounded-full transition-all" style:width={`${score ?? 0}%`}></div>
      </div>
    </div>

    <!-- Recruiters -->
    <div class="card flex flex-col cursor-pointer" role="button" tabindex="0"
      onclick={() => onnav("recruiters")} onkeydown={(e) => e.key === "Enter" && onnav("recruiters")}>
      <div class="label"><Users size={16} class="text-dim" /> Recruiters</div>
      <div class="value mt-auto">{ov.recruiters}</div>
    </div>

    <!-- Accepted -->
    <div class="card flex flex-col">
      <div class="label"><CheckCircle2 size={16} class="text-green" /> Accepted</div>
      <div class="value mt-auto">{ov.accepted}</div>
    </div>

    <!-- Replied -->
    <div class="card flex flex-col">
      <div class="label"><Reply size={16} class="text-cyan" /> Replied</div>
      <div class="value mt-auto">{ov.replied}</div>
    </div>

    <!-- Interviews (accent-tinted) -->
    <div
      class="relative overflow-hidden rounded-xl p-5 flex flex-col cursor-pointer transition-colors bg-[#5e6ad2]/10 border border-[#5e6ad2]/30 hover:bg-[#5e6ad2]/20"
      role="button" tabindex="0"
      onclick={() => onnav("interviews")} onkeydown={(e) => e.key === "Enter" && onnav("interviews")}
    >
      <div class="absolute inset-0 bg-gradient-to-t from-[#5e6ad2]/20 to-transparent"></div>
      <div class="z-10 text-[0.82rem] font-[510] text-accent-hover flex items-center gap-2" style="color: var(--color-accent-hover);">
        <Video size={16} /> Interviews
      </div>
      <div class="z-10 text-[2rem] font-[510] tracking-[-0.704px] text-white mt-auto">{ov.interviews}</div>
    </div>

    <!-- Jobs Saved (wide row) -->
    <div class="lg:col-span-2 card flex items-center justify-between cursor-pointer" role="button" tabindex="0"
      onclick={() => onnav("jobs")} onkeydown={(e) => e.key === "Enter" && onnav("jobs")}>
      <div class="flex items-center gap-4">
        <div class="w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center border border-border">
          <Bookmark size={20} class="text-muted" />
        </div>
        <div>
          <div class="text-[0.95rem] font-[510] text-text">Jobs Saved</div>
          <div class="text-[0.82rem] text-dim">Ready to apply</div>
        </div>
      </div>
      <div class="text-[1.5rem] font-[510] tracking-[-0.288px] text-text">{ov.jobs}</div>
    </div>
  </div>

  <!-- Panels -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {#if breakdown.length}
      <div class="panel mb-0">
        <h3>Profile breakdown
          <a class="text-[0.78rem] font-normal text-cyan ml-1" href={"#"} onclick={(e) => { e.preventDefault(); onnav("profile"); }}>view details →</a>
        </h3>
        <div class="bd-grid">
          {#each breakdown as item, i}
            {#if i > 0}<div class="bd-divider"></div>{/if}
            <div class="bd-row">
              <span class="bd-label">{item.label}</span>
              {#if item.value}<span class="bd-pill {pillClass(item.value)}">{item.value}</span>{/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="panel mb-0 flex flex-col">
      <h3>Pipeline health</h3>
      <div class="p-4 bg-panel-2 border border-border-2 rounded-lg mb-6 flex-1" style="box-shadow: rgba(0,0,0,0.2) 0 0 12px 0 inset;">
        <p class="text-[0.95rem] text-muted leading-[1.6]">
          <strong class="text-text font-[510]">{ov.recruiters} recruiters</strong> contacted ·
          <strong class="text-text font-[510]">{ov.accepted} accepted</strong> ·
          <strong class="text-text font-[510]">{ov.replied} replied</strong> ·
          <strong class="font-[510]" style="color: var(--color-accent-hover);">{ov.interviews} interviews</strong> scheduled.
          {#if score === null}
            <br />Run a profile scan to capture your first score + breakdown.
          {/if}
        </p>
      </div>
      <button class="btn-primary w-full" onclick={() => onnav("profile")}>
        <ScanLine size={18} /> Scan profile
      </button>
    </div>
  </div>
{/if}
