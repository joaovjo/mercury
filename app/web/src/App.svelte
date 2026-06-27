<script>
  import { api, onConnection, post, subscribe } from "./api.js";
  import { resource } from "./lib/resource.svelte.js";
  import { useLiveTable } from "./lib/live.svelte.js";
  import Overview from "./sections/Overview.svelte";
  import Recruiters from "./sections/Recruiters.svelte";
  import Outreach from "./sections/Outreach.svelte";
  import Jobs from "./sections/Jobs.svelte";
  import Search from "./sections/Search.svelte";
  import Launch from "./sections/Launch.svelte";
  import Profile from "./sections/Profile.svelte";
  import Applications from "./sections/Applications.svelte";
  import Interviews from "./sections/Interviews.svelte";
  import Activity from "./sections/Activity.svelte";
  import Answers from "./sections/Answers.svelte";
  import {
    LayoutDashboard, UserRound, Search as SearchIcon, Rocket, Users,
    Briefcase, FileText, CalendarClock, Activity as ActivityIcon, Download,
    ClipboardList, Send,
  } from "@lucide/svelte";

  let active = $state("overview");
  let connected = $state(false);
  let updating = $state(false);
  let updateOutput = $state("");

  // Overview drives the sidebar badges + the Overview page. Refresh it when any
  // table that feeds its counts changes.
  const overview = resource(() => api("overview"), null);
  const updateStatus = resource(() => api("update-status"), null);
  useLiveTable(
    ["recruiters", "jobs", "interviews", "applications", "profile_metrics"],
    overview.reload
  );

  $effect(() => onConnection((c) => (connected = c)));
  $effect(() => subscribe((msg) => {
    if (msg.type !== "update") return;
    const event = msg.event;
    if (event.type === "line") {
      updateOutput = (updateOutput + event.text).slice(-2000);
    } else if (event.type === "done") {
      updating = false;
      updateOutput += event.code === 0
        ? "\nUpdate complete. Restart the dashboard to use the new binary.\n"
        : `\nUpdate failed with exit code ${event.code}.\n`;
      updateStatus.reload();
    }
  }));

  async function startUpdate() {
    updating = true;
    updateOutput = "Starting update...\n";
    try {
      await post("update");
    } catch (err) {
      updating = false;
      updateOutput += `${err.message ?? err}\n`;
    }
  }

  const nav = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "profile", label: "Profile", icon: UserRound },
    { id: "search", label: "Search", icon: SearchIcon },
    { id: "launch", label: "Launch", icon: Rocket },
    { id: "recruiters", label: "Recruiters", icon: Users },
    { id: "outreach", label: "Outreach", icon: Send },
    { id: "jobs", label: "Jobs", icon: Briefcase },
    { id: "applications", label: "Applications", icon: FileText },
    { id: "answers", label: "Answers", icon: ClipboardList },
    { id: "interviews", label: "Interviews", icon: CalendarClock },
    { id: "activity", label: "Activity", icon: ActivityIcon },
  ];

  let ov = $derived(overview.status === "ready" ? overview.data : null);
  let activeLabel = $derived(nav.find((n) => n.id === active)?.label ?? "");
  // Show the update affordance as a full card only when an update is actually
  // available; when up-to-date we collapse to a tiny muted version line.
  let updateAvailable = $derived(
    updateStatus.status === "ready" && updateStatus.data?.updateAvailable
  );
</script>

<div class="flex h-screen overflow-hidden">
  <!-- Sidebar -->
  <aside class="hidden md:flex flex-col w-64 shrink-0 bg-panel border-r border-border-2 p-4">
    <!-- Brand -->
    <div class="flex items-center gap-3 px-3 py-4 mb-4">
      <div
        class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style="background: linear-gradient(135deg, #7170ff, #5e6ad2); box-shadow: 0 2px 10px rgba(113,112,255,0.4);"
      >
        <Rocket size={17} strokeWidth={2.2} class="text-white" />
      </div>
      <div class="leading-tight">
        <h1 class="text-[1.05rem] font-[590] tracking-[-0.24px] text-text">Mercury</h1>
        <p class="text-[0.72rem] text-dim">AI Job Companion</p>
      </div>
    </div>

    <!-- Nav -->
    <nav class="flex-1 flex flex-col gap-1 overflow-y-auto">
      {#each nav as item}
        {@const Icon = item.icon}
        <button
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[0.875rem] transition-colors
                 {active === item.id
                   ? 'bg-white/[0.05] text-text font-[590]'
                   : 'text-muted font-[510] hover:text-text hover:bg-white/[0.02]'}"
          onclick={() => (active = item.id)}
        >
          <Icon size={18} strokeWidth={2} class={active === item.id ? "text-cyan" : ""} />
          <span>{item.label}</span>
          {#if item.id === "recruiters" && ov}<span class="ml-auto text-[0.72rem] text-faint">{ov.recruiters}</span>{/if}
          {#if item.id === "interviews" && ov}<span class="ml-auto text-[0.72rem] text-faint">{ov.interviews}</span>{/if}
          {#if item.id === "jobs" && ov}<span class="ml-auto text-[0.72rem] text-faint">{ov.jobs}</span>{/if}
        </button>
      {/each}
    </nav>

    <!-- Footer: update status + live indicator -->
    <div class="mt-auto pt-4 border-t border-border-2 space-y-3">
      {#if updateAvailable}
        <div class="rounded-xl border border-border bg-panel-2 p-3 text-[0.76rem]">
          <div class="font-[590] text-text mb-1">Mercury {updateStatus.data.latest} available</div>
          <div class="text-dim mb-2">You have {updateStatus.data.current}</div>
          <button
            class="w-full flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-cyan hover:bg-white/[0.05] disabled:opacity-60"
            disabled={updating}
            onclick={startUpdate}
          >
            <Download size={14} />
            {updating ? "Updating..." : "Update now"}
          </button>
          {#if updateOutput}
            <pre class="mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-[0.68rem] text-muted font-mono">{updateOutput}</pre>
          {/if}
        </div>
      {:else if updateStatus.status === "ready"}
        <div class="text-[0.7rem] text-faint px-1">Mercury {updateStatus.data?.current}</div>
      {/if}
      <div class="text-[0.74rem] text-dim flex items-center gap-1.5 px-1">
        <span class="w-2 h-2 rounded-full inline-block"
          style:background={connected ? "var(--color-green)" : "var(--color-faint)"}
          style:box-shadow={connected ? "0 0 8px var(--color-green)" : "none"}></span>
        {connected ? "live" : "offline"}
      </div>
    </div>
  </aside>

  <!-- Main content -->
  <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
    <!-- Top app bar -->
    <header
      class="flex items-center justify-between px-6 py-3 sticky top-0 z-30 w-full border-b border-border-2"
      style="background: rgba(8,9,10,0.8); backdrop-filter: blur(12px);"
    >
      <div class="flex items-center text-[0.8rem] font-[510] text-dim">
        <span>Workspace</span>
        <span class="mx-2 text-white/10">/</span>
        <span class="text-muted">{activeLabel}</span>
      </div>
      <div class="flex items-center gap-1.5 text-[0.74rem] text-dim">
        <span class="w-2 h-2 rounded-full inline-block"
          style:background={connected ? "var(--color-green)" : "var(--color-faint)"}
          style:box-shadow={connected ? "0 0 8px var(--color-green)" : "none"}></span>
        {connected ? "live" : "offline"}
      </div>
    </header>

    <!-- Scroll canvas -->
    <main class="flex-1 overflow-y-auto px-6 md:px-10 lg:px-12 pt-8 pb-20">
      <div class="max-w-[1200px] mx-auto">
        {#if active === "overview"}<Overview {overview} onnav={(id) => (active = id)} />
        {:else if active === "profile"}<Profile />
        {:else if active === "search"}<Search />
        {:else if active === "launch"}<Launch />
        {:else if active === "recruiters"}<Recruiters />
        {:else if active === "outreach"}<Outreach />
        {:else if active === "jobs"}<Jobs />
        {:else if active === "applications"}<Applications />
        {:else if active === "answers"}<Answers />
        {:else if active === "interviews"}<Interviews />
        {:else if active === "activity"}<Activity />
        {/if}
      </div>
    </main>
  </div>
</div>
