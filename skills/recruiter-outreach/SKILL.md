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

### 4. Draft Connection Notes

**Constraints:**
- Max ~300 characters (LinkedIn truncates on mobile)
- Must be specific (company + role type + your signal)
- No fluff ("I'd be honored to connect with you")
- Don't ask "are there openings?" — assume there are (you saw the listings)

**Template:**
```
Hi {Name} — I'm {User}, {Role} at {Company} ({City}), working on {specialty} with {stack}. I saw {Target} is {growth signal} and I'm interested in the {role type} roles. Would love to connect and chat if you're hiring for that area.
```

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
  --status pending --note "{mutuals / context}"
```

When a recruiter accepts or replies, update their status:
```
mercury recruiter update --id {id} --status accepted   # or: replied | interviewing | closed
```

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

## Gotchas

1. **URN IDs are required** — `current_company="airbnb"` returns unfiltered results (silently ignored)
2. **Some company pages are broken** (e.g., Brex returns "Page not available") — fall back to keyword search without company filter: `search_people(keywords="Brex recruiter engineer Brazil")`
3. **Recruiter titles vary**: Sourcer, Technical Recruiter, Talent Acquisition, Recruiting Coordinator — all valid but prioritize Sourcers and Technical Recruiters for IC roles
4. **"Message" button vs "Connect"**: 3rd+ degree shows "Message" (uses InMail credits) or "Follow". "Connect" with note is preferred for 2nd-degree.
5. **Diversity of time zones**: US-based recruiters covering LatAm are common at big tech — don't skip them just because they're not local
6. **Mutual connections matter**: mention them in the note if relevant ("We share mutual connections in the Amazon SP office")
