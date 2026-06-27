<script>
  import { api } from "../api.js";
  import { resource } from "../lib/resource.svelte.js";
  import { useLiveTable } from "../lib/live.svelte.js";
  import LoadingState from "../lib/LoadingState.svelte";
  import ErrorState from "../lib/ErrorState.svelte";
  import { Send, Clock, Ban, Mail } from "@lucide/svelte";

  const outreach = resource(() => api("outreach"), null);
  useLiveTable("outreach_attempts", outreach.reload);

  let d = $derived(outreach.status === "ready" ? outreach.data : null);

  // Lifecycle states in funnel order, each with a label + accent token.
  const FUNNEL = [
    { key: "queued", label: "Queued", cls: "text-faint", dot: "#3e3e44" },
    { key: "invited", label: "Invited", cls: "text-cyan", dot: "#5e6ad2" },
    { key: "accepted", label: "Accepted", cls: "text-cyan", dot: "#06b6d4" },
    { key: "followed_up", label: "Followed up", cls: "text-amber", dot: "#f59e0b" },
    { key: "engaged", label: "Engaged", cls: "text-green", dot: "#10b981" },
    { key: "invite_ignored", label: "Invite ignored", cls: "text-red", dot: "#ef4444" },
    { key: "unresponsive", label: "Unresponsive", cls: "text-red", dot: "#ef4444" },
    { key: "do_not_contact", label: "Do not contact", cls: "text-dim", dot: "#3e3e44" },
  ];

  // Due-action pill styling by kind.
  const ACTION = {
    withdraw: { label: "WITHDRAW", cls: "bg-red/10 text-red border-red/30" },
    followup: { label: "FOLLOW UP", cls: "bg-amber/10 text-amber border-amber/30" },
    close: { label: "CLOSE", cls: "bg-white/[0.04] text-dim border-border-2" },
  };
</script>

<h1 class="page-title">Outreach</h1>
<p class="page-sub">
  Relationship memory — who you've contacted, what's due, and your InMail budget.
</p>

{#if outreach.status === "loading"}
  <LoadingState rows={4} />
{:else if outreach.status === "error"}
  <ErrorState error={outreach.error} onretry={outreach.reload} />
{:else if d}
  <!-- Funnel -->
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
    {#each FUNNEL as s}
      <div class="bg-white/[0.02] border border-border-2 rounded-xl p-4 flex flex-col gap-1.5">
        <span class="flex items-center gap-2 text-[0.72rem] {s.cls}">
          <span class="w-2 h-2 rounded-full" style:background={s.dot}></span>
          {s.label}
        </span>
        <span class="text-[1.5rem] font-[590] text-text leading-none">{d.funnel[s.key] ?? 0}</span>
      </div>
    {/each}
  </div>

  <div class="grid lg:grid-cols-3 gap-5">
    <!-- Due today (spans 2) -->
    <div class="lg:col-span-2 bg-white/[0.02] border border-border-2 rounded-xl p-5">
      <div class="flex items-center gap-2 mb-4">
        <Clock size={16} class="text-amber" />
        <h3 class="text-[0.95rem] font-[590] text-text">Due today</h3>
        {#if d.due.length}<span class="ml-auto text-[0.72rem] text-faint">{d.due.length}</span>{/if}
      </div>
      {#if d.due.length === 0}
        <div class="text-[0.82rem] text-dim py-6 text-center">Nothing due — you're all caught up.</div>
      {:else}
        <div class="space-y-2">
          {#each d.due as item}
            {@const a = ACTION[item.actionKind] ?? ACTION.close}
            <div class="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-border-2">
              <span class="shrink-0 mt-0.5 px-2 py-0.5 rounded text-[0.62rem] font-[590] tracking-wide border {a.cls}">
                {a.label}
              </span>
              <div class="min-w-0 flex-1">
                <div class="text-[0.85rem] text-text truncate">
                  {#if item.person_username}
                    <a href={`https://www.linkedin.com/in/${item.person_username}/`} target="_blank" class="hover:text-cyan">
                      {item.person_name ?? item.person_username}
                    </a>
                  {:else}{item.person_name ?? "—"}{/if}
                  <span class="text-faint"> @ {item.company_name ?? item.company_urn}</span>
                </div>
                <div class="text-[0.72rem] text-dim mt-0.5">{item.actionReason}</div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Right column: budget + blocked -->
    <div class="space-y-5">
      <!-- InMail budget -->
      <div class="bg-white/[0.02] border border-border-2 rounded-xl p-5">
        <div class="flex items-center gap-2 mb-3">
          <Mail size={16} class="text-cyan" />
          <h3 class="text-[0.95rem] font-[590] text-text">InMail budget</h3>
          <span class="ml-auto text-[0.68rem] uppercase tracking-wide text-faint">{d.budget.plan}</span>
        </div>
        <div class="flex items-end gap-2 mb-3">
          <span class="text-[2rem] font-[590] text-text leading-none">{d.budget.credits_remaining}</span>
          <span class="text-[0.75rem] text-dim mb-1">credits remaining</span>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded-lg bg-white/[0.02] border border-border-2 p-2">
            <div class="text-[0.95rem] font-[590] text-text">{d.budget.reserve_floor}</div>
            <div class="text-[0.62rem] text-faint">reserve</div>
          </div>
          <div class="rounded-lg bg-white/[0.02] border border-border-2 p-2">
            <div class="text-[0.95rem] font-[590] text-text">{d.budget.credits_used_this_cycle}</div>
            <div class="text-[0.62rem] text-faint">used</div>
          </div>
          <div class="rounded-lg bg-white/[0.02] border border-border-2 p-2">
            <div class="text-[0.95rem] font-[590] text-text">{d.budget.inmail_monthly_allotment}</div>
            <div class="text-[0.62rem] text-faint">monthly</div>
          </div>
        </div>
      </div>

      <!-- Blocked by company -->
      <div class="bg-white/[0.02] border border-border-2 rounded-xl p-5">
        <div class="flex items-center gap-2 mb-3">
          <Ban size={16} class="text-red" />
          <h3 class="text-[0.95rem] font-[590] text-text">Blocked by company</h3>
        </div>
        {#if d.blocked.length === 0}
          <div class="text-[0.78rem] text-dim py-2">No one blocked.</div>
        {:else}
          <div class="space-y-1.5">
            {#each d.blocked as b}
              <div class="flex items-center gap-2 text-[0.82rem]">
                <span class="text-text truncate flex-1">{b.company_name ?? b.company_urn}</span>
                <span class="shrink-0 px-1.5 py-0.5 rounded bg-red/10 text-red text-[0.68rem] border border-red/20">{b.count}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
