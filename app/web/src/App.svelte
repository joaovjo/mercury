<script>
  import { api, onConnection, post, subscribe } from "./api.js";
  import { resource } from "./lib/resource.svelte.js";
  import { useLiveTable } from "./lib/live.svelte.js";
  import Overview from "./sections/Overview.svelte";
  import Recruiters from "./sections/Recruiters.svelte";
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
    ClipboardList,
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
    { id: "jobs", label: "Jobs", icon: Briefcase },
    { id: "applications", label: "Applications", icon: FileText },
    { id: "answers", label: "Answers", icon: ClipboardList },
    { id: "interviews", label: "Interviews", icon: CalendarClock },
    { id: "activity", label: "Activity", icon: ActivityIcon },
  ];

  let ov = $derived(overview.status === "ready" ? overview.data : null);
</script>

<div class="grid grid-cols-[220px_1fr] min-h-screen">
  <aside class="relative bg-panel border-r border-border px-3.5 py-[22px] sticky top-0 h-screen">
    <div class="grad text-2xl font-extrabold mb-7 pl-2">Mercury</div>
    {#each nav as item}
      {@const Icon = item.icon}
      <button
        class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[9px] text-[0.92rem] font-medium border
               {active === item.id
                 ? 'bg-panel-2 text-text border-border-2'
                 : 'text-muted border-transparent hover:bg-panel-2 hover:text-text'}"
        onclick={() => (active = item.id)}
      >
        <Icon size={17} strokeWidth={2} />
        <span>{item.label}</span>
        {#if item.id === "recruiters" && ov}<span class="ml-auto text-[0.72rem] text-dim">{ov.recruiters}</span>{/if}
        {#if item.id === "interviews" && ov}<span class="ml-auto text-[0.72rem] text-dim">{ov.interviews}</span>{/if}
        {#if item.id === "jobs" && ov}<span class="ml-auto text-[0.72rem] text-dim">{ov.jobs}</span>{/if}
      </button>
    {/each}
    <div class="absolute bottom-[18px] left-3.5 right-3.5 space-y-3">
      {#if updateStatus.status === "ready"}
        <div class="rounded-xl border border-border bg-panel-2 p-3 text-[0.76rem]">
          <div class="font-semibold text-text mb-1">
            {#if updateStatus.data?.updateAvailable}
              Mercury {updateStatus.data.latest} available
            {:else}
              Mercury {updateStatus.data?.current}
            {/if}
          </div>
          <div class="text-dim mb-2">
            {updateStatus.data?.updateAvailable ? `You have ${updateStatus.data.current}` : "Up to date"}
          </div>
          <button
            class="w-full flex items-center justify-center gap-1.5 rounded-lg border border-border-2 px-2 py-1.5 text-cyan hover:bg-panel disabled:opacity-60"
            disabled={updating}
            onclick={startUpdate}
          >
            <Download size={14} />
            {updating ? "Updating..." : updateStatus.data?.updateAvailable ? "Update now" : "Reinstall latest"}
          </button>
          {#if updateOutput}
            <pre class="mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-[0.68rem] text-muted font-mono">{updateOutput}</pre>
          {/if}
        </div>
      {/if}
      <div class="text-[0.74rem] text-dim flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full inline-block"
          style:background={connected ? "var(--color-green)" : "var(--color-dim)"}
          style:box-shadow={connected ? "0 0 8px var(--color-green)" : "none"}></span>
        {connected ? "live" : "offline"}
      </div>
    </div>
  </aside>

  <main class="px-9 pt-[30px] pb-20 max-w-[1180px]">
    {#if active === "overview"}<Overview {overview} onnav={(id) => (active = id)} />
    {:else if active === "profile"}<Profile />
    {:else if active === "search"}<Search />
    {:else if active === "launch"}<Launch />
    {:else if active === "recruiters"}<Recruiters />
    {:else if active === "jobs"}<Jobs />
    {:else if active === "applications"}<Applications />
    {:else if active === "answers"}<Answers />
    {:else if active === "interviews"}<Interviews />
    {:else if active === "activity"}<Activity />
    {/if}
  </main>
</div>
