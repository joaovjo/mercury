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
- **Mercury CLI** — `mercury answer`, `mercury match`, `mercury application`, `mercury export`.
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
  mercury answer set --key phone --value "+1 555 ..." --category contact
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
   tree with element uids. Collect the visible field **labels**.
2. Map labels to answer keys with the deterministic matcher — don't eyeball it:

   ```
   mercury match --labels '["Email *","Phone","Will you require sponsorship?", ...]'
   ```

   It joins the labels against your `applicant_answers` and returns a plan:

   ```json
   {
     "matched":  [{ "label": "Email *", "key": "email",
                    "value": "me@example.com", "confidence": 1, "reason": "exact" }],
     "unfilled": [{ "label": "Phone", "skip": "no-stored-answer", "key": "phone" },
                  { "label": "Gender", "skip": "eeo-human-only", "key": "eeo_gender" },
                  { "label": "Favorite color", "skip": "no-match" }]
   }
   ```

3. Fill **only** the `matched` entries with `fill` / `fill_form` (batch via
   `pipeline`), keyed back to the snapshot uid for each label. Upload the resume
   PDF to the resume file field.
4. **Leave every `unfilled` field empty** and keep its list for the review
   summary. The `skip` reason tells the user why:
   - `no-stored-answer` — recognized, but you have no value stored (add one with
     `mercury answer set` if you want it auto-filled next time).
   - `eeo-human-only` — EEO/demographic; **never auto-filled**, human enters it.
   - `no-match` / `ambiguous` — couldn't confidently map it; human handles it.
5. `take_snapshot` + `take_screenshot` and present a "review these N fields
   before you submit" summary.

> [!WARNING]
> Truthfulness guardrails carry over from `resume-tailor`: **never invent
> answers** (work authorization, years of experience, EEO). The matcher already
> refuses to fill EEO fields and anything with no stored value — respect its
> `unfilled` list, don't fill those by hand from assumptions.

### 4a. Real-world fill mechanics (learned against a live Greenhouse form)

ATS forms are messier than a flat label list suggests. Handle these:

- **Plain text/tel/email inputs** fill reliably. Set the value and dispatch
  `input` + `change` events (React-controlled inputs ignore a bare value set).
- **Phone fields** are often an `intl-tel-input` widget that **reformats** the
  number (e.g. `(+12) 34 5 6789-0000` → `+12 34 567890000`). The reformatted
  value is correct — don't treat the difference as a failure.
- **Dropdowns are comboboxes, not text inputs.** Many questions that look like
  free-text (country of residence, "require sponsorship?", yes/no screeners) are
  `Select...` comboboxes. You must click to open, then click the option — typing
  a raw value may not register. Confirm the selected text after.
- **File uploads are unreliable via a single `upload_file`.** Greenhouse/Lever
  use async S3-backed widgets behind an "Attach" button and swap the underlying
  `<input type=file>` out after selection. Click "Attach", upload, then
  **verify the chosen filename is shown** before trusting it; if it didn't land,
  tell the user to attach the PDF manually. (PDF is produced by `mercury export`.)
- **reCAPTCHA / SSO** may gate submission — out of scope; leave for the human.

When something can't be filled programmatically, add it to the review summary as
a "do this yourself" item rather than silently skipping it.

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
