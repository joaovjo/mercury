---
name: experience-bank
description: >-
  Periodically interview the candidate ("grill me") about new achievements,
  projects, and experiences, and fold them into a structured, tagged store in
  .mercury/experience/. Run occasionally (e.g. quarterly) — NOT per application.
  resume-tailor reads this bank to surface role-relevant experience that doesn't
  fit on the short base resume. Use when the user says "grill me", "update my
  experience bank", or wants to capture recent work. Part of the Mercury toolkit.
---

# Experience Bank

Build and maintain a deep, reusable pool of the candidate's achievements so
`resume-tailor` can surface role-relevant experience that doesn't fit on the
(necessarily short) base resume.

This is a **periodic maintenance** skill — run it once to seed, then refresh
every quarter/semester or after shipping something notable. It is **not** part
of the per-application flow.

```
experience-bank  ──writes──▶  .mercury/experience/   (deep, tagged pool)
                                      │ read-only
                                      ▼
profile-optimizer → job-scout → resume-tailor → recruiter-outreach
                                      └─ selects role-relevant entries
```

## Prerequisites

- **LinkedIn MCP** — `get_person_profile` (seed material, gap detection)
- The user's base resume (if present) and the existing bank in `.mercury/experience/`

## Data Directory

```
.mercury/
└── experience/
    ├── {slug}.md        # one achievement/project per entry (frontmatter + STAR body)
    └── index.md         # rollup table for quick scanning
```

Entry frontmatter schema (tags drive cheap per-role retrieval):

```yaml
---
title: Cut checkout p99 latency 40%
slug: checkout-latency-40pct
skills: [performance, distributed-systems, observability]
tech: [java, aws, sqs, dynamodb]
domain: [payments, e-commerce]
role_type: [backend, platform]
metrics: ["p99 -40%", "2M events/day"]
scope: "team of 6, 2M daily orders"
dates: "2024-Q3"
on_resume: false        # is this already on the base resume?
source: interview       # interview | freeform | linkedin | resume
---
```

## Workflow

### 1. Load What Already Exists (never start from scratch)

- Read every entry in `.mercury/experience/` (if any) → know what's already captured
- Read the base resume (`.mercury/base/resume.*`) if present
- Pull `get_person_profile(...)` for experience/projects already on LinkedIn
- Build a mental set of "covered" achievements so you only ask about **gaps and new material**

If the directory doesn't exist, create it — this is the seeding run.

### 2. Grill the Candidate (interactive elicitation)

Conversational interview loop using a **STAR** frame. Probe for the things people
leave off resumes:

- **Situation/Task** — what was the context and the problem?
- **Action** — what did *you specifically* do? (separate your work from the team's)
- **Result** — quantified impact: metrics, %, scale, revenue, latency, users
- **Scope** — team size, budget, scale (req/s, data volume, $)
- **Tech** — the stack actually used (not aspirational)

Rules:
- Ask **one focused question at a time**; follow the thread before moving on.
- Push for numbers when answers are vague ("how much faster?", "how many users?").
- Only spend questions on **new or thin** material — skip anything already well-captured.
- Stop when the user is out of new material or says they're done.

Also accept **freeform dumps**: if the user pastes a raw story, structure and tag
it without re-interviewing.

### 3. Structure & Store (incremental, idempotent)

For each new/updated achievement:
- Write `.mercury/experience/{slug}.md` with the frontmatter schema + a tight STAR body
- **Dedupe**: if it matches an existing entry, update it rather than create a duplicate
- Set `on_resume: true` for things already on the base resume (so tailor knows what's "extra")
- Regenerate `index.md` — a table of all entries (title, skills, tech, domain, metrics)

### 4. Persist to Mercury

Log the maintenance run so the dashboard reflects it:

```
mercury activity log --skill experience-bank --summary "Captured {N} new entries; bank now {total}"
```

> If `mercury` isn't installed, just write the files — the bank still works
> standalone; only the dashboard activity log is skipped.

## Truthfulness (non-negotiable)

- Capture **real** stories and **real** numbers — the skill structures and
  reprioritizes, it **never invents** achievements, metrics, or scope.
- If the user can't quantify something, store it qualitatively rather than
  fabricating a number.

## Integration with resume-tailor

At application time (no interview), `resume-tailor`:
- Matches the job's requirements/stack against entry tags (`skills`, `tech`, `domain`, `role_type`)
- Selects the best-fitting entries — **even if they aren't on the base resume**
- Keeps the gap report honest: distinguishes "you have this, it's in your bank
  (not your resume)" from a genuine miss

## Example

```
User: "grill me — I shipped a few things this quarter"

Agent:
1. Loads existing bank + base resume + LinkedIn profile
2. "You don't have anything tagged 'observability' yet. Did you do any
    monitoring/alerting work recently?"
3. … STAR follow-ups, pushing for metrics …
4. Writes .mercury/experience/checkout-latency-40pct.md + updates index.md
5. mercury activity log --skill experience-bank --summary "Captured 3 new entries; bank now 14"
```
