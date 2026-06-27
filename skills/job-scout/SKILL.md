---
name: job-scout
description: >-
  Search and evaluate open roles on LinkedIn matching a candidate's profile,
  target companies, locations, and compensation goals. Returns structured
  shortlists with fit assessment, job IDs, and direct links. Use when user
  wants to find roles at specific companies or in specific locations/work-types,
  or pastes a LinkedIn Jobs search URL (multi-company f_C / geoId / recency) to
  reproduce — with an auto-widening time window when nothing recent is found.
  Part of the Mercury job search toolkit.
---

# LinkedIn Job Scout

Research open roles on LinkedIn and produce a prioritized shortlist matched to
the candidate's profile, level, stack, and preferences.

## Prerequisites

- **LinkedIn MCP** — `search_jobs`, `get_job_details`, `get_company_profile`
- **Chrome MCP** — to open a pasted LinkedIn Jobs URL and scrape results in the
  session where you're logged into LinkedIn (auto-starts on first tool call).
  Required for the "pasted URL" workflow below; the keyword workflow can run on
  LinkedIn MCP alone.

**Preflight (do this first):** run `mercury linkedin reset` once before your
first LinkedIn MCP call. It clears stale browser sessions/locks the previous run
may have left behind (the usual cause of `search_jobs` failing, especially on
Windows). Harmless if there's nothing to clean.

## Two Entry Points

job-scout supports two ways to start:

1. **Pasted LinkedIn search URL** (§A) — the user hands you a saved Jobs search
   URL (often scoped to dozens of target companies via `f_C`). Honor it exactly.
2. **Criteria-driven keyword search** (§B) — the classic flow when there's no URL.

Both converge on the same detail → fit → shortlist → persist steps (§3–§6).

## A. Pasted LinkedIn Search URL

When the user pastes a `https://www.linkedin.com/jobs/search/?...` URL, do **not**
fall back to loose keyword searches. Parse and honor its query parameters.

### A1. Parse the URL

Extract these query params (URL-decode `%2C` → `,`):

| Param | Meaning | Use |
|---|---|---|
| `f_C` | comma-separated **company URN IDs** (e.g. `1586,309694,3205573`) | restrict results to these employers — **the most important filter** |
| `geoId` | numeric location id (e.g. `103644278` = United Kingdom) | exact location (overrides free-text `location`) |
| `f_TPR` | recency window as `r<seconds>` (e.g. `r20000` ≈ last 5.5h) | starting time window for the widening loop (§A3) |
| `keywords` | search terms (e.g. `Product Manager`) | the query |
| `sortBy` | `DD` (newest) / `R` (relevance) | sort order |
| `f_WT` | work type (`1` on-site, `2` remote, `3` hybrid) | work-type filter |
| `start` | result offset (25 per page) | pagination |

Map `f_C` URN IDs back to company names using the URN table (§URN Lookup) so the
shortlist is human-readable; resolve unknown IDs with `get_company_profile`.

### A2. Run the search — honoring `f_C`

**Primary path (Chrome MCP) — reproduces the search exactly:**

The external LinkedIn MCP `search_jobs` tool does **not** expose `f_C`/`geoId`/
`f_TPR`, so to honor a multi-company URL faithfully, drive the browser:

```
chrome: navigate_page(url = "<the pasted URL, with f_TPR set per §A3>")
chrome: wait_for(["results", "No matching jobs"])
chrome: take_snapshot   # scrape job cards: title, company, location, job id, posted-ago
```

Use the `pipeline` tool to batch navigate → wait_for → snapshot in one call.
Paginate by bumping `start` (`start=0,25,50,…`) until you have enough or results
run out. Extract the job id from each card's `/jobs/view/{id}/` link.

**Fallback path (LinkedIn MCP) — when Chrome MCP isn't available:**

LinkedIn ANDs `f_C` entries as an OR over companies, which `search_jobs` can't
express in one call. Approximate it by running one search per URN's company name
and merging:

```
for each company in f_C:
    search_jobs(keywords="{keywords} {companyName}", location="{geoId→name}", max_pages=2)
```

Then **drop any result whose company isn't in the `f_C` set** (keyword matches
leak other employers), dedupe by job id, and sort by posted date if `sortBy=DD`.
Note in your output that this path is approximate.

### A3. Auto-widen the recency window

A tight `f_TPR` (e.g. `r20000` ≈ 5.5h), especially scoped to a company set, often
returns **zero** results. Don't stop there — progressively widen and re-run the
**same** company/keyword/geo query at each step:

```
r20000 (or the URL's value)  →  r86400 (24h)  →  r604800 (7d)  →  r2592000 (30d)
```

- Start at the user's requested window.
- If the result count is below the threshold (default **5**), widen to the next
  step and re-run. On the Chrome path, **rewrite the URL's `f_TPR=r<seconds>`**
  to the next value and re-navigate; on the LinkedIn MCP path, re-run the
  per-company searches at the wider window.
- **Stop** at the first window that meets the threshold, or at the cap (default
  30d).
- **Always tell the user how far you widened**, e.g.
  _"Nothing in the last 5.5h; showing the last 7 days (12 roles)."_

Configurable via `~/.mercury/config.toml`:

```toml
[job_scout]
auto_widen = true        # set false to honor the exact window only
widen_threshold = 5      # widen while fewer than this many results
widen_cap = "30d"        # 5h | 24h | 7d | 30d — don't widen past this
```

If `auto_widen = false`, honor the exact `f_TPR` and report the count as-is.

Then continue at **§3 (Get Details)**.

## B. Criteria-Driven Keyword Search

### 1. Gather Target Criteria

From the user, establish:
- **Target companies** (specific names)
- **Location** (city, country, or "remote")
- **Work type** (on-site, hybrid, remote)
- **Level** (junior/mid/senior/staff — infer from YoE if not stated)
- **Stack** (languages, frameworks, cloud)
- **Compensation goals** (USD? local currency? range?)

### 2. Search Jobs

Run the searches **one at a time, not in parallel**. The LinkedIn MCP drives a
single shared headless browser, so concurrent `search_jobs` calls collide and
fail — issue them sequentially and wait for each to return before the next:
```
search_jobs(keywords="{company} software engineer", location="{city}", max_pages=2)
# ...then:
search_jobs(keywords="backend software engineer", location="{city}", work_type="remote", max_pages=2)
# ...then:
search_jobs(keywords="{niche_skill} engineer", location="{country}", work_type="remote", max_pages=2)
```

If a `search_jobs` call still fails (a stale browser session from a prior run is
holding the profile — common on Windows), run `mercury linkedin reset` once to
clear it, then retry the call.

### 3. Get Details for Top Matches

For the most promising job IDs:
```
get_job_details(job_id)
```

Extract: requirements, YoE asked, stack match, compensation (if listed), team info, English requirement.

### 4. Assess Fit

For each role, rate as:
- **⭐ Strong** — level matches, stack aligns, location works
- **Good** — most criteria match, minor stretch on one dimension
- **Stretch** — notably above stated level or missing key requirement

### 5. Present Shortlist

Use two tables:

**Location-based roles:**
| Role | Company | Mode | Fit | Link |
|---|---|---|---|---|

**Remote / USD roles:**
| Role | Company | Comp | Fit | Link |
|---|---|---|---|---|

Include job ID links as: `[{id}](https://www.linkedin.com/jobs/view/{id}/)`

### 5b. Persist to Mercury

Save each shortlisted role to the Mercury database (powers the dashboard's Jobs section):

```
mercury job save \
  --linkedin-id {id} --title "{Role}" --company "{Company}" \
  --location "{City}" --work-type "{remote|hybrid|onsite}" \
  --comp "{comp if known}" --fit "{strong|good|stretch}" \
  --link "https://www.linkedin.com/jobs/view/{id}/"
```

Log the scout run:
```
mercury activity log --skill job-scout --summary "Scouted {N} roles for {query}"
```

> If `mercury` isn't installed, just present the shortlist tables (below).

### 6. Flag Caveats

- Diversity-scoped roles ("Vaga para mulheres", "PCD-only") — note eligibility
- Staffing aggregators with high stated comp — flag for legitimacy verification
- Roles requiring significantly more YoE than candidate has
- External ATS vs Easy Apply (affects application friction)

## Compensation Reality Check

Most Brazil-remote listings hide compensation. When visible:
- **Staffing firms** (Crossing Hurdles, Hire Feed, Quik Hire): often inflated or contractor rates — verify
- **Legitimate product companies** hiring BR-remote in USD: Airbnb, DoorDash, Brex, Uber, Kraken, ClassPass, TRM Labs, Wellhub, Engine, Housecall Pro, Motorola
- **$45/hr contracts** ≈ $93K/yr; **$80-100K** = typical mid-senior LatAm remote; **$180-230K** = verify carefully

## Company URN Lookup

Numeric URN IDs are used two ways: the `search_people(current_company=...)`
filter, and decoding a pasted URL's `f_C=` list (§A1) back to company names.

```
get_company_profile(company_name) → references.about → company_urn.value
```

Common URNs (extend as you resolve more — these are stable):
- Amazon: 1586
- Airbnb: 309694
- DoorDash: 3205573
- Uber: 1815218

> The `f_C` list in a saved search can hold ~40+ URNs. Decode the ones you know
> from this table; resolve the rest with `get_company_profile` (and consider
> adding them here). Unknown URNs still work as filters — you just show the raw
> id until resolved.

## geoId Reference

`geoId` (from a pasted URL) pins location more precisely than free-text. Common:
- United Kingdom: 103644278
- United States: 103644278 _(verify per-search; geoIds differ by country/city)_
- Brazil: 106057199

> geoIds aren't fully stable across LinkedIn surfaces — when honoring a pasted
> URL via Chrome MCP you pass the URL verbatim, so the `geoId` is used as-is and
> you don't need to map it. Only map it when falling back to the LinkedIn MCP
> path, which takes a free-text `location`.
