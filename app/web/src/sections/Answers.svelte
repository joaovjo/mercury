<script>
  import { api, post } from "../api.js";
  import { resource } from "../lib/resource.svelte.js";
  import { useLiveTable } from "../lib/live.svelte.js";
  import LoadingState from "../lib/LoadingState.svelte";
  import ErrorState from "../lib/ErrorState.svelte";

  // The reusable answer store that portal-filler draws from. Editable here so
  // the user can curate PII / eligibility / links without touching the CLI.
  const answers = resource(() => api("answers"), []);
  useLiveTable("applicant_answers", answers.reload);

  const CATEGORIES = ["contact", "eligibility", "links", "eeo", "custom"];

  // Inline edit state, keyed by answer key.
  let drafts = $state({});
  let saving = $state({});

  // New-answer form.
  let newKey = $state("");
  let newValue = $state("");
  let newCategory = $state("contact");
  let addError = $state("");

  function startEdit(a) {
    drafts[a.key] = a.value ?? "";
  }

  async function saveEdit(a) {
    saving[a.key] = true;
    try {
      await post("answer", { key: a.key, value: drafts[a.key], category: a.category });
      delete drafts[a.key];
    } finally {
      saving[a.key] = false;
    }
  }

  async function addAnswer() {
    addError = "";
    const key = newKey.trim();
    if (!key) { addError = "Key is required."; return; }
    try {
      await post("answer", { key, value: newValue, category: newCategory });
      newKey = ""; newValue = ""; newCategory = "contact";
    } catch (e) {
      addError = e.message ?? "Failed to save.";
    }
  }

  // Group rows by category for display.
  let grouped = $derived.by(() => {
    const g = {};
    for (const a of answers.data ?? []) (g[a.category] ??= []).push(a);
    return g;
  });
</script>

<h1 class="page-title">Answers</h1>
<p class="page-sub">
  Reusable application answers — portal-filler fills external ATS forms from these.
  EEO answers are stored but never auto-filled.
</p>

{#if answers.status === "loading"}
  <LoadingState />
{:else if answers.status === "error"}
  <ErrorState error={answers.error} onretry={answers.reload} />
{:else}
  <!-- Add new answer -->
  <div class="panel mb-4">
    <div class="flex flex-wrap gap-2 items-center">
      <input class="input flex-1 min-w-[140px]" placeholder="key (e.g. phone)" bind:value={newKey} />
      <input class="input flex-1 min-w-[140px]" placeholder="value" bind:value={newValue} />
      <select class="input" bind:value={newCategory}>
        {#each CATEGORIES as c}<option value={c}>{c}</option>{/each}
      </select>
      <button class="btn-primary" onclick={addAnswer}>Add</button>
    </div>
    {#if addError}<div class="text-red text-[0.8rem] mt-2">{addError}</div>{/if}
  </div>

  {#if (answers.data ?? []).length === 0}
    <div class="empty">No answers yet. Add your contact details, links, and eligibility above.</div>
  {:else}
    {#each CATEGORIES as cat}
      {#if grouped[cat]?.length}
        <h2 class="text-[0.8rem] uppercase tracking-wide text-dim mt-5 mb-2">{cat}</h2>
        <div class="panel">
          <table>
            <thead><tr><th>Key</th><th>Value</th><th class="w-[120px]"></th></tr></thead>
            <tbody>
              {#each grouped[cat] as a}
                <tr>
                  <td class="font-medium">{a.key}</td>
                  <td>
                    {#if a.key in drafts}
                      <input class="input w-full" bind:value={drafts[a.key]} />
                    {:else}
                      <span class={a.value ? "" : "dim"}>{a.value || "—"}</span>
                    {/if}
                  </td>
                  <td class="text-right">
                    {#if a.key in drafts}
                      <button class="btn-success" disabled={saving[a.key]} onclick={() => saveEdit(a)}>Save</button>
                    {:else}
                      <button class="text-cyan hover:underline text-[0.82rem]" onclick={() => startEdit(a)}>Edit</button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/each}
  {/if}
{/if}
