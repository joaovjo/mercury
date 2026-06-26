---
name: resume-tailor
description: >-
  Tailor a candidate's resume to specific scouted roles using their base resume
  and LinkedIn profile data. Produces role-specific Typst resumes, cover letters,
  and gap/match reports. Supports batch tailoring to multiple roles in one pass.
  Use when user wants to customize their resume for a specific job application.
  Part of the Mercury job search toolkit.
---

# Resume Tailor

Take a candidate's existing resume + one or more scouted job listings and
produce role-tailored versions with gap analysis, ATS keyword alignment, and
full cover letters.

## Prerequisites

- **LinkedIn MCP** — `get_person_profile`, `get_job_details`
- User's base resume (Typst preferred, also supports MD/txt/PDF)

## Data Directory

All artifacts live in `.mercury/` at the workspace root:

```
.mercury/
├── base/
│   └── resume.typ              # Canonical base resume (copied on first run)
├── tailored/
│   ├── {company}-{jobId}.typ   # Tailored resume per role
│   └── ...
├── cover-letters/
│   ├── {company}-{jobId}.md    # Full cover letter per role
│   └── ...
├── reports/
│   ├── {company}-{jobId}.md    # Gap/match report per role
│   └── ...
├── logs/
│   ├── {ISO-timestamp}.md      # Run log with changes, scores, diffs
│   └── ...
└── config.toml                 # Preferences (base path, format, defaults)
```

On first run, create `.mercury/` and copy the user's base resume into `base/`.

## Workflow

### 1. Gather Inputs

- **Base resume**: Read from `.mercury/base/resume.typ` (or init from user-provided path)
  - Supported formats: `.typ`, `.md`, `.txt`, `.pdf` (PDF → text extraction)
- **Experience bank**: Read all entries in `.mercury/experience/` (if present). This is the deep, tagged pool of achievements that don't fit on the short base resume — built by the `experience-bank` skill. Read-only here.
- **LinkedIn profile**: Fetch via `get_person_profile(username, sections: "experience,education,skills,projects,certifications")`
- **Target roles**: Accept one or more job IDs → fetch each via `get_job_details(job_id)`

Batch mode: accepts a list of job IDs and processes all in one pass.

### 2. Extract Job Requirements (per role)

For each job description, extract:
- **Required skills** (languages, frameworks, tools)
- **Nice-to-have skills**
- **Years of experience** asked
- **Domain/industry** keywords
- **ATS-critical terms** (exact technology names, methodologies, certifications)
- **Level signals** (IC vs lead, team size, scope descriptors)

Normalize into a structured requirements object.

### 3. Gap/Match Analysis (per role)

Cross-reference candidate's profile + resume + experience bank against requirements:

| Category | Meaning |
|---|---|
| ✅ Strong match | Direct experience with this skill/domain, in resume **or experience bank** |
| 🟡 Transferable | Adjacent experience that can be framed toward this requirement |
| ❌ Gap | Genuine miss — not present in resume, profile, or experience bank |

Output a markdown table per role → saved to `.mercury/reports/{company}-{jobId}.md`

Include:
- Overall keyword coverage score (% of ATS terms present)
- Top 3 strengths to emphasize
- Top gaps with suggested framing (if transferable) or honest acknowledgment
- **Bank pulls**: relevant experience-bank entries NOT on the base resume — flag these as "you have this, it's in your bank" rather than gaps

### 4. Tailor the Resume (per role)

Transform the base resume for the specific role:

1. **Reorder experience bullets** — lead with role-relevant work
2. **Pull from the experience bank** — inject the highest-matching `.mercury/experience/` entries (by tag overlap with the job's requirements/stack) that strengthen this role, even if absent from the base resume. Keep the resume concise: swap weaker base bullets for stronger bank-backed ones rather than just appending.
3. **Rephrase descriptions** — echo job description language for ATS matching
4. **Adjust summary/objective** — target the specific role and company
5. **Surface relevant projects** — pull from LinkedIn projects/OSS that match
6. **Keyword injection** — ensure critical ATS terms appear naturally
7. **Preserve format** — maintain the user's Typst structure, tone, and style

> Only use bank entries the candidate actually has. The bank is pre-vetted as
> truthful by `experience-bank`; never invent or embellish beyond what's stored.

Output → `.mercury/tailored/{company}-{jobId}.typ`

### 5. Generate Cover Letter (per role)

Write a full cover letter (~250-400 words):

- **Hook** — tied to the company, team, or product (not generic)
- **Body** — maps candidate's top 3-4 experiences to role requirements
- **Gaps** — acknowledge honestly with growth framing (if any)
- **Close** — concrete interest statement + availability

Output → `.mercury/cover-letters/{company}-{jobId}.md`

### 6. Log & Report

Write a run log to `.mercury/logs/{ISO-timestamp}.md`:
- Jobs processed (company, ID, title)
- Keyword coverage scores per role
- Changes made vs base resume (diff summary)
- Gaps flagged

Also persist each tailored application to the Mercury database (powers the dashboard's Applications section):

```
mercury application add \
  --job-id {db job id, if saved via job-scout} \
  --resume-path ".mercury/tailored/{company}-{jobId}.typ" \
  --cover-path ".mercury/cover-letters/{company}-{jobId}.md" \
  --report-path ".mercury/reports/{company}-{jobId}.md" \
  --keyword-score {0-100} --status draft

mercury activity log --skill resume-tailor --summary "Tailored resume for {N} roles"
```

Print a summary table to the user:

| Role | Company | Keyword Score | Strengths | Gaps | Files |
|---|---|---|---|---|---|
| SWE | Airbnb | 87% | Java, AWS, Dist Sys | GraphQL | tailored/airbnb-123.typ |

## Truthfulness Guardrails

These are non-negotiable:

1. **NEVER** add skills the candidate doesn't demonstrably have
2. **NEVER** fabricate experience, projects, or inflate titles
3. **NEVER** claim certifications not held
4. Flag gaps honestly — suggest framing for adjacent experience, not invention
5. Cover letters must only claim experience backed by resume/profile/experience-bank data
6. If a requirement is a genuine miss, say so in the report and suggest addressing it transparently in the cover letter

## Integration Points

- **experience-bank** → the deep, tagged achievement pool read-only at step 1; lets tailoring go beyond the short base resume (run periodically via the `experience-bank` skill)
- **job-scout** → feeds job IDs directly into resume-tailor (batch mode)
- **profile-optimizer** → complementary (profile = inbound discovery, resume = outbound applications)
- **recruiter-outreach** → cover letter content can be adapted as connection note material

## Example Usage

```
User: "Tailor my resume for these roles: 4393940374, 3969556398, 4380982336"

Agent:
1. Reads .mercury/base/resume.typ
2. Reads .mercury/experience/ bank entries
3. Fetches LinkedIn profile
4. Fetches all 3 job details in parallel
5. Produces 3 tailored resumes (pulling role-relevant bank entries), 3 cover letters, 3 gap reports
6. Logs the run
7. Presents summary table
```
