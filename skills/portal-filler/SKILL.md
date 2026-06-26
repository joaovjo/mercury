---
name: portal-filler
description: >-
  Autofill external ATS application forms (Greenhouse, Lever, Ashby, and a
  generic fallback) from an identified opportunity and its tailored artifacts,
  using Chrome MCP. Fills fields, dropdowns, file uploads, and screener
  questions, then STOPS for human review — it never clicks the final Submit.
  Use when the user wants to apply to a scouted job's external portal. Part of
  the Mercury job search toolkit.
---

# Portal Filler

Take an identified opportunity (a `jobs` row with an external `link`) plus its
tailored artifacts from `resume-tailor`, navigate the employer's ATS with
Chrome MCP, and fill the application form. **Fill, then pause for human review —
never auto-submit.** This mirrors the `confirm_send` human-in-the-loop pattern
used by `recruiter-outreach`.

> [!IMPORTANT]
> This skill **fills, it does not submit.** Always end by handing the
> already-open browser back to the candidate to verify and click Submit
> themselves. Do not click the final Submit/Apply button.

## Prerequisites

- **Chrome MCP** — `navigate_page`, `take_snapshot`, `fill`, `fill_form`,
  `click`, `upload_file`, `take_screenshot` (and `pipeline` to batch them).
- **Mercury CLI** — `mercury answer`, `mercury application`, `mercury export`.
- A reusable answer store populated via `mercury answer set` (see below).
- Tailored artifacts on disk: the `.typ` resume and the cover letter.

## Workflow

### 1. Load inputs

- Resolve the opportunity: the `jobs` row (id, company, title, `link`).
- Confirm tailored artifacts exist for it (resume `.typ`, cover letter).
- Load the reusable answer store:

  ```
  mercury answer list
  ```

  Keys are canonical field ids grouped by `category`:
  `contact` (email, phone), `eligibility` (work_authorization,
  requires_sponsorship, salary_expectation), `links` (linkedin_url,
  github_url), `eeo` (eeo_gender, eeo_veteran, eeo_disability), `custom`.

  If a required key is missing, ask the user once and persist it so it's
  reusable next time:

  ```
  mercury answer set --key phone --value "+55 ..." --category contact
  ```

### 2. Produce the upload PDF

Chrome MCP `upload_file` needs a real file; `resume-tailor` emits `.typ`. Compile
it with the shared helper:

```
mercury export --typ ".mercury/tailored/{company}-{jobId}.typ" \
               --out ".mercury/tailored/{company}-{jobId}.pdf"
```

The cover letter is uploaded as-is when the form has a file field, or pasted
into a textarea when it has one.

### 3. Detect the ATS

Inspect the opportunity `link` host and the page DOM:

| Host contains      | Portal       |
|--------------------|--------------|
| `greenhouse.io`    | `greenhouse` |
| `lever.co`         | `lever`      |
| `ashbyhq.com`      | `ashby`      |
| anything else      | `generic`    |

> Per-ATS adapters (stable field maps for Greenhouse/Lever/Ashby) are a later
> phase. Until then, use the generic snapshot-driven flow below for **all**
> portals; record the detected `portal` so adapters can be layered on.

### 4. Generic fill (snapshot → label-match → fill → pause)

1. `navigate_page` to the `link`, then `take_snapshot` to get the live form
   tree with element uids.
2. Match each visible form label to an `applicant_answers` key by
   fuzzy/synonym matching (e.g. "Email address" → `email`, "Will you now or in
   the future require sponsorship" → `requires_sponsorship`).
3. Fill only **confident** matches with `fill` / `fill_form` (batch via
   `pipeline`). Upload the resume PDF to the resume file field.
4. **Leave unmatched or ambiguous fields empty** and collect their labels.
5. **Never auto-fill EEO/demographic fields** (gender, veteran, disability) even
   if stored — leave them for the human at review time.
6. End with `take_snapshot` + `take_screenshot` and present a
   "review these N fields before you submit" summary.

> [!WARNING]
> Truthfulness guardrails carry over from `resume-tailor`: **never invent
> answers** (work authorization, years of experience, EEO). Unknown or
> ambiguous fields go to the unfilled list and are surfaced — never guessed.

### 5. Persist + surface

Record what happened so the dashboard reflects it (table-scoped live refresh):

```
# first time for this opportunity
mercury application add --job-id {jobId} --portal {portal} \
  --external-url "{link}" \
  --resume-path ".mercury/tailored/{company}-{jobId}.pdf" --status draft

# after filling
mercury application update --id {appId} --status filled \
  --portal {portal} --external-url "{link}" \
  --fields '{json of what was entered}' \
  --unfilled '["work_authorization","eeo_gender", ...]'

mercury activity log --skill portal-filler \
  --summary "Filled {company} {title} ({portal}) — {N} fields, {M} left for review"
```

Status lifecycle: `draft → filled → submitted` (use `needs_input` when blocked
on a missing answer). The candidate moves it to `submitted` after they click
Submit — or you set it on their confirmation; this skill never submits.

### 6. Hand off

Tell the user exactly which fields to verify and which were intentionally left
blank (especially EEO), and that the browser is open and ready for them to
review and submit.

## Out of scope (v1)

- Workday, Taleo, iCIMS (multi-step, iframe-heavy, account-gated).
- Fully autonomous submit.
- CAPTCHA / SSO automation.

## Summary table to print

| Field group | Filled | Left for review |
|---|---|---|
| Contact | email, phone | — |
| Eligibility | requires_sponsorship | work_authorization (verify) |
| Links | linkedin_url, github_url | — |
| EEO | — | gender, veteran, disability (human-only) |
| Resume | uploaded PDF | — |
