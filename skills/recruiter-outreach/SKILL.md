---
name: recruiter-outreach
description: >-
  Find technical recruiters at target companies on LinkedIn and send tailored
  connection requests. Looks up company URN IDs, searches by role+location,
  prioritizes by proximity and mutual connections, and sends notes under 300
  characters. Use when user wants to reach recruiters at specific companies.
  Part of the Mercury job search toolkit.
---

# LinkedIn Recruiter Outreach

Find and connect with technical recruiters at target companies who are hiring
in the user's region.

## Prerequisites

- **LinkedIn MCP** — `get_company_profile`, `search_people`, `connect_with_person`
- **Mercury CLI** — `mercury outreach check|log|budget` for blacklist gating,
  attempt logging, and InMail-credit budgeting (see §3b, §3c, §6)

## Workflow

### 1. Get Company URN IDs

LinkedIn's people search requires numeric URN IDs for the `current_company` filter:

```
get_company_profile("airbnb") → references.about → find company_urn → value: "309694"
```

Plain-text company names are **silently ignored** by the filter — always use URNs.

### 2. Search for Recruiters

```
search_people(
  current_company="{URN_ID}",
  keywords="recruiter engineer {country/region}"
)
```

Variations to try if results are sparse:
- `"technical recruiter {country}"`
- `"talent acquisition engineer {country}"`
- `"sourcer engineer {region}"`
- `"tech recruiter Latin America"` (for LatAm roles)

### 3. Prioritize Results

Rank by these criteria (in order):

1. **Same country/city as user** (they recruit locally)
2. **2nd-degree connection** (can connect directly with note)
3. **Mutual connections** (warm path, higher accept rate)
4. **Title explicitly mentions engineering/technical** (not generic HR)
5. **Profile snippet mentions the target region** (e.g., "hiring in Brazil")

Deprioritize:
- Recruiting Coordinators (limited decision-making power)
- Leadership/Executive recruiters (wrong level for IC roles)
- 3rd+ degree with no mutuals (low accept rate)

### 3b. Blacklist check — skip anyone already blocked for THIS company

Before drafting or sending anything, gate **each** candidate against Mercury's
outreach memory. A block is scoped to **(person, company URN)** — someone you
already pestered at this company is off-limits here, but fair game once they
move elsewhere. Always resolve the company URN first (§1).

```
mercury outreach check --username "{linkedin_username}" --company-urn "{URN}"
```

- **Exit 0 / "OK"** → proceed.
- **Exit 1 / "BLOCKED: …"** → **skip** this person for this company and tell the
  user why (the reason + cooldown date are printed). Do not re-invite. If they
  also show as a 1st-degree connection who simply hasn't replied, that's still a
  block — don't double-message.

This prevents re-pestering people who ignored a prior request and keeps your
accept-rate (and reputation) healthy.

### 3c. Choose the cheapest effective channel (cost-aware)

Outreach has two **separate** budgets: the weekly connection-invite limit
(~100/week, free) and scarce paid **InMail credits**. Prefer free paths and only
spend a credit when there's no warmer route. Check the InMail budget with
`mercury outreach budget` before considering InMail.

Priority order:

1. **1st degree** → free direct **message**.
2. **2nd degree** → free **connection request + note** (uses the weekly invite
   budget, *not* an InMail credit). This is the default for recruiter outreach.
3. **3rd+ degree, Open Profile** → free **InMail** (no credit spent).
4. **3rd+ degree, high-value, no warmer path** → spend **1 InMail credit** — but
   only if `credits_remaining − reserve_floor ≥ 1`. Otherwise seek a
   mutual-connection **intro** or **queue** the person until fresh credits.

Surface the chosen channel + cost to the user; never exceed the reserve floor.

### 4. Draft Connection Notes

**Constraints:**
- Max ~300 characters (LinkedIn truncates on mobile)
- Must be specific (company + role type + your signal)
- No fluff ("I'd be honored to connect with you")
- Don't ask "are there openings?" — assume there are (you saw the listings)
- **Never restate what LinkedIn already shows on the request UI** — the
  recipient already sees your shared/mutual connections, their own title, and
  the connection degree. Writing "we share mutual connections (X, Y)" is
  redundant filler that reads as a templated mail-merge and wastes the ~300
  char budget. Spend those characters on intent + why-them instead.
- **Lead with intent + why-this-company, not a résumé dump.** A short stack
  signal is fine, but the note's job is to say what you want and why they're a
  fit — not to list everything on your profile (they can click through).

**Template:**
```
Hi {Name} — I'm {User}, a {role/specialty} engineer ({1-line stack signal}). {One concrete reason THIS company/team fits — e.g. "GitLab's all-remote engineering culture is how I want to work" or "you hire backend across LATAM & the Americas"}. Would love to connect about {role type} roles.
```

> The "why-them" clause is the highest-leverage part. Pull it from the company
> profile (all-remote, region focus, growth signal) or the recruiter's own
> headline ("you recruit backend across the Americas"). Skip it only if you
> genuinely have nothing specific — a generic note still beats a templated one.

**Adapt per company:**
- DoorDash: "growing the SP engineering hub"
- Airbnb: "building out the engineering hub in Brazil"
- Uber: "hiring engineers in Brazil"
- Brex: "hiring engineers in Brazil"

**Level calibration:**
- If user doesn't identify as Senior, omit "Senior" from role type
- Use general terms: "Backend Engineer roles", "engineering opportunities"

### 5. Send Connection Requests

```
connect_with_person(linkedin_username="{username}", note="{tailored_note}")
```

**Rate limiting:**
- Max 10-15 connection requests per session
- Space them out if sending many (LinkedIn may restrict)
- If status returns "already pending", note it and move on

### 6. Persist to Mercury

After each connection request is sent, record it in the Mercury database via the CLI (this powers the dashboard):

```
mercury recruiter add \
  --name "{Name}" --company "{Company}" --username "{linkedin_username}" \
  --title "{Title}" --location "{City}" --degree "{2nd|3rd}" \
  --status pending --note "{internal tracking note: mutuals, why-them, region}"
```

> This `--note` is your *private* Mercury record (recording mutuals here is
> useful for follow-up context) — it is NOT the LinkedIn connection note.

**Also record the outreach attempt** in the relationship-memory log, scoped by
company URN. This is what powers blacklist checks (§3b), the follow-up cadence,
and the Outreach dashboard. Do this after *every* send:

```
mercury outreach log \
  --username "{linkedin_username}" --name "{Name}" \
  --company-urn "{URN}" --company "{Company}" \
  --channel connect_note \
  --source-skill recruiter-outreach
```

- For a **1st-degree direct message**, use `--channel message`.
- For an **InMail** that spent a credit, use `--channel inmail --cost 1` (this
  decrements the tracked budget and opens the 90-day refund window).
- A freshly-logged attempt starts in state `invited` and the tracker will
  compute its follow-up/withdraw due-dates automatically.

When a recruiter accepts or replies, update both records:
```
mercury recruiter update --id {id} --status accepted   # or: replied | interviewing | closed
mercury outreach update --id {attemptId} --state accepted   # or: engaged (on reply)
```

> Marking `engaged` on a reply also refunds an InMail credit if one was spent
> within the 90-day window.

Log the outreach wave as an activity entry (always pass `--kind` — a bare
`mercury activity log` silently inserts an empty, uncategorized row):
```
mercury activity log --kind outreach --skill recruiter-outreach \
  --summary "Sent {N} requests to {companies}"
```

Other useful kinds: `recruiter_update` (status change), `outreach` (requests sent).
Add structured data with `--payload '{"recruiter_id":N,"event":"..."}'`.

> If the `mercury` CLI isn't installed, fall back to appending a row to the
> Recruiter Outreach Tracker table in the user's journal markdown.

### 7. Present Results Table

| Recruiter | Company | Title | Location | Degree | Status |
|---|---|---|---|---|---|
| Name | Company | Their title | City | 2nd/3rd | ✅ Sent / ⏳ Pending |

### 8. Follow-up Guidance

Provide the user with:

**If accepted but no reply (wait 3 business days):**
```
Thanks for connecting, {Name}! I'm {User} — {Role} at {Company} ({City}), {stack}. Interested in engineering roles at {Target}. Happy to chat if there's a fit.
```

**If no response after 1 week:** Move on. Don't double-message recruiters.

### 9. Sync acceptances (reconcile pending → accepted)

LinkedIn's MCP has no "who accepted my invitations" tool. The reliable signal is
**connection degree**: a recruiter recorded as `pending` who now appears in your
**1st-degree** network has accepted. To detect this without manual checking:

```
mercury recruiter sync            # dry-run: shows what WOULD change
mercury recruiter sync --apply    # writes the pending → accepted transitions
mercury recruiter sync --json     # machine-readable (used by the dashboard)
```

How it works: for each `pending` recruiter that has a company, it runs a
first-degree people search (`search_people network=["F"] keywords="<company>
recruiter"`) and matches returned people back to your pending rows by username
(preferred) or normalized name. Matches advance to `accepted` (sets
`accepted_at`). It **only** advances `pending → accepted` — it never touches
human-confirmed states (`replied`, `interviewing`, `closed`), since those encode
knowledge the degree signal can't see.

Requirements & notes:
- Needs the LinkedIn MCP reachable (it drives the search). Companies whose search
  errors are reported as "skipped", not fatal.
- Recruiters with no stored `company` are skipped (there's nothing to search).
- For best matching, store the recruiter's `--username` when you add them. If you
  later learn it, backfill with `mercury recruiter update --id {id} --username {slug}`
  (the `update` subcommand now also accepts `--username/--company/--title/--location/--degree`).
- In the dashboard, the **Recruiters** tab has a **Sync now** button that runs the
  same reconciliation and surfaces due follow-ups inline.

> Manual fallback (no CLI): re-fetch each pending recruiter's profile and check the
> degree, or run a 1st-degree company search yourself; flip the ones now showing
> "1st" to accepted.

## Gotchas

1. **URN IDs are required** — `current_company="airbnb"` returns unfiltered results (silently ignored)
2. **Some company pages are broken** (e.g., Brex returns "Page not available") — fall back to keyword search without company filter: `search_people(keywords="Brex recruiter engineer Brazil")`
3. **Recruiter titles vary**: Sourcer, Technical Recruiter, Talent Acquisition, Recruiting Coordinator — all valid but prioritize Sourcers and Technical Recruiters for IC roles
4. **"Message" button vs "Connect"**: 3rd+ degree shows "Message" (uses InMail credits) or "Follow". "Connect" with note is preferred for 2nd-degree.
5. **Diversity of time zones**: US-based recruiters covering LatAm are common at big tech — don't skip them just because they're not local
6. **Don't restate auto-shown info in the note**: LinkedIn already displays
   your mutual connections, the recipient's title, and the connection degree on
   the request UI. Restating "we share mutual connections (X, Y)" is redundant
   and looks templated. Only reference shared context LinkedIn does NOT surface
   — e.g. "we both worked at Smart BR", "met at {conf}", "I follow your posts on
   {topic}". When prioritizing recruiters, mutuals still matter (warmer accept
   rate) — just don't spend note characters announcing them.
