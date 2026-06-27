<script>
  import { api, post } from "../api.js";
  import { resource } from "../lib/resource.svelte.js";
  import { useLiveTable } from "../lib/live.svelte.js";
  import LoadingState from "../lib/LoadingState.svelte";
  import ErrorState from "../lib/ErrorState.svelte";
  import { Plus, Pencil, Lock, ListPlus } from "@lucide/svelte";

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

  function cancelEdit(a) {
    delete drafts[a.key];
    drafts = { ...drafts };
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

  const categoryItems = [
    { value: "contact", label: "Contact" },
    { value: "links", label: "Links" },
    { value: "eligibility", label: "Eligibility" },
    { value: "custom", label: "Custom" },
  ];
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
  <div class="bg-white/[0.02] border border-border rounded-xl p-4 mb-10">
    <div class="flex flex-col sm:flex-row gap-3 items-end">
      <label class="field-label flex-1 w-full">Key
        <input class="input normal-case font-normal w-full" placeholder="e.g. portfolio_url" bind:value={newKey} />
      </label>
      <label class="field-label flex-[1.5] w-full">Value
        <input class="input normal-case font-normal w-full" placeholder="Value to insert" bind:value={newValue} />
      </label>
      <label class="field-label flex-1 w-full">Category
        <select class="input normal-case font-normal w-full" bind:value={newCategory}>
          {#each categoryItems as c}<option value={c.value}>{c.label}</option>{/each}
        </select>
      </label>
      <button class="btn-primary" onclick={addAnswer}><Plus size={16} /> Add</button>
    </div>
    {#if addError}<div class="text-red text-[0.8rem] mt-2">{addError}</div>{/if}
  </div>

  {#if (answers.data ?? []).length === 0}
    <div class="empty">No answers yet. Add your contact details, links, and eligibility above.</div>
  {:else}
    <div class="space-y-10">
      {#each CATEGORIES as cat}
        {@const rows = grouped[cat] ?? []}
        {@const isEeo = cat === "eeo"}
        {#if rows.length || cat === "custom"}
          <section class={isEeo ? "opacity-70 grayscale-[30%] hover:opacity-100 hover:grayscale-0 transition-all duration-300" : ""}>
            <div class="flex items-center gap-3 mb-3 ml-1">
              <h3 class="text-[0.7rem] font-[510] text-dim uppercase tracking-[0.5px]">{cat}</h3>
              {#if isEeo}
                <span class="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border bg-bg text-faint">
                  <Lock size={12} />
                  <span class="text-[0.6rem] font-[510] tracking-wide">HUMAN-ONLY — NEVER AUTO-FILLED</span>
                </span>
              {/if}
            </div>

            {#if rows.length}
              <div class="bg-white/[0.02] border {isEeo ? 'border-dashed border-border-2' : 'border-border-2'} rounded-xl overflow-hidden" style="box-shadow: inset 0 0 12px rgba(0,0,0,0.2);">
                {#each rows as a, i}
                  {@const editing = a.key in drafts}
                  <div class="flex items-center px-4 py-3 group transition-colors {i < rows.length - 1 ? 'border-b border-white/[0.03]' : ''} {editing ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}">
                    <div class="w-[30%]">
                      <span class="font-mono text-[0.8rem] {isEeo ? 'text-faint' : 'text-dim'}">{a.key}</span>
                    </div>
                    <div class="flex-1 pr-4">
                      {#if editing}
                        <input class="w-full bg-bg border border-border rounded px-2 py-1 text-[0.875rem] text-text focus:outline-none focus:border-blue" bind:value={drafts[a.key]} />
                      {:else}
                        <span class="text-[0.875rem] {a.value ? (isEeo ? 'text-muted italic' : 'text-text') : 'text-faint'}">{a.value || "—"}</span>
                      {/if}
                    </div>
                    {#if editing}
                      <div class="flex gap-2">
                        <button class="btn-ghost !px-2 !py-1 !text-[0.72rem]" onclick={() => cancelEdit(a)}>Cancel</button>
                        <button class="px-2 py-1 rounded text-[0.72rem] font-[510] text-text bg-white/[0.05] hover:bg-white/[0.08] border border-border disabled:opacity-60" disabled={saving[a.key]} onclick={() => saveEdit(a)}>Save</button>
                      </div>
                    {:else}
                      <div class="w-12 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="text-dim hover:text-text p-1 rounded hover:bg-white/[0.05]" onclick={() => startEdit(a)} aria-label="Edit"><Pencil size={16} /></button>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {:else}
              <div class="bg-white/[0.02] border border-border-2 rounded-xl flex flex-col items-center justify-center py-8" style="box-shadow: inset 0 0 12px rgba(0,0,0,0.2);">
                <ListPlus size={28} class="text-faint mb-2" />
                <p class="text-[0.82rem] text-dim">No custom answers added yet.</p>
              </div>
            {/if}
          </section>
        {/if}
      {/each}
    </div>
  {/if}
{/if}
