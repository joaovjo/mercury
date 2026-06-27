---
name: outreach-tracker
description: >-
  Review open LinkedIn outreach and run the follow-up lifecycle: compute what's
  due today (gentle nudges, invitation withdrawals, close-outs), draft the text
  for each, and detect replies — all surfaced for explicit user approval. Never
  auto-sends. Updates Mercury's outreach memory and InMail-credit budget as
  actions are taken. Good for a scheduled daily run. Part of the Mercury job
  search toolkit.
---

# Outreach Tracker

Drive the outreach follow-up lifecycle from Mercury's relationship memory: find
what needs action today, draft each message/withdrawal/close, and apply the
state change once the user approves. This is the companion to `recruiter-outreach`
(which *initiates* outreach and records attempts); the tracker *maintains* them.

## Core principle: draft + ask, never auto-send

`require_send_consent` is on by default. This skill **drafts** messages and
**proposes** actions; the human approves each one before anything is sent or
withdrawn on LinkedIn. Do not send, message, or withdraw without explicit
per-action consent.

## Prerequisites

- **Mercury CLI** — `mercury outreach due|update|blocked|budget`
- **LinkedIn MCP** — `get_inbox`, `get_conversation` (reply detection),
  `send_message` (approved nudges)
- **Chrome MCP** — for invitation withdrawal (no MCP withdraw tool exists)

## Workflow

### 1. Find what's due

```
mercury outreach due
```

Each line is one of three action kinds with the person, company, and reason:

- `[WITHDRAW]` — an invite has gone unaccepted past the threshold (~7d).
- `[FOLLOWUP]` — they accepted but haven't replied to your first message (~4d).
- `[CLOSE]` — your follow-up went unanswered past the grace window (~7d).

Also glance at the InMail budget so you can factor credit cost into any
InMail-based follow-ups:

```
mercury outreach budget
```

### 2. Detect replies FIRST (before acting on anything)

A reply rescues an attempt from any cadence — never nudge or close someone who
already responded. For each due item (and any `accepted`/`followed_up` attempt),
check the conversation:

```
get_conversation(linkedin_username = "{username}")   # or search_conversations / get_inbox
```

If they replied after your last message, mark it engaged and stop automation for
that person:

```
mercury outreach update --id {attemptId} --state engaged --reason "replied: {gist}"
```

> Marking `engaged` also **refunds an InMail credit** if one was spent within
> the 90-day window — the budget updates automatically.

### 3. Handle each remaining due action (with consent)

**[FOLLOWUP] — accepted, no reply:**
Draft a short, friendly nudge (≤ ~400 chars, specific, no guilt-trip). Show it
to the user. On approval, send and record:

```
send_message(linkedin_username = "{username}", message = "{approved text}", confirm_send = true)
mercury outreach update --id {attemptId} --state followed_up --reason "gentle nudge sent"
```

**[WITHDRAW] — invite ignored:**
Explain you'll withdraw the pending invitation (recalling the note). The LinkedIn
MCP has **no withdraw tool**, so drive the browser with Chrome MCP:

```
chrome: navigate_page("https://www.linkedin.com/mynetwork/invitation-manager/sent/")
chrome: take_snapshot            # locate the row for {Name}
chrome: click(<the person's "Withdraw" button>)
chrome: handle_dialog(accept)    # confirm if prompted
```

Then record the outcome (this also company-blocks them so they're skipped in
future `recruiter-outreach` runs):

```
mercury outreach update --id {attemptId} --state invite_ignored --reason "invite withdrawn after {N}d"
```

> Or use `mercury outreach withdraw --id {attemptId}` — it marks the block and,
> if the browser step couldn't be confirmed, degrades gracefully (the invite may
> still linger on LinkedIn; the block bookkeeping still happens).
>
> **Caveats to tell the user:** LinkedIn blocks re-inviting a withdrawn person
> for ~3 weeks; weekly invite limits still apply; sent notes can't be edited
> (only withdrawn).

**[CLOSE] — follow-up exhausted:**
No send needed. Mark unresponsive (company-blocks them):

```
mercury outreach update --id {attemptId} --state unresponsive --reason "no reply after follow-up"
```

### 4. Summarize

Present a short table of what was done and what's pending approval:

| Person | Company | Action | Status |
|---|---|---|---|
| Name | Company | FOLLOWUP / WITHDRAW / CLOSE / ENGAGED | sent / withdrawn / closed / awaiting approval |

Note the updated InMail budget (credits remaining vs reserve floor) if any
InMail action was taken or refunded.

## Notes

- A block is scoped to **(person, company URN)** and expires after the configured
  cooldown (default 9 months) — the tracker doesn't permanently burn a contact.
- Reply detection is best-effort; if the inbox tools can't confirm a reply, fall
  back to asking the user "did {Name} reply?" before nudging or closing.
- This skill is safe to run on a daily schedule: with consent gating on, the
  worst case is a list of drafts awaiting your approval.
