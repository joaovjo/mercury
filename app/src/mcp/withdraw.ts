/**
 * Invitation withdrawal (issue #11 §5 — capability gap).
 *
 * The LinkedIn MCP exposes connect/accept/send/inbox but NO withdraw tool, so
 * recalling a pending invitation must be driven through browser automation
 * (My Network → Sent → Withdraw). This module isolates that fragile path behind
 * a single function so the rest of the system degrades gracefully: if the
 * browser flow fails, callers still mark the attempt blocked (the invite simply
 * lingers on LinkedIn until it's manually withdrawn or expires).
 *
 * NOTE: This is intentionally a best-effort stub. The browser steps run in the
 * agent layer (Chrome MCP) at the time the `outreach-tracker` skill executes a
 * due withdrawal; this function returns false here so the CLI path degrades to
 * "company-blocked, withdrawal unconfirmed" rather than pretending success.
 *
 * Caveats to encode at the call site / skill:
 *  - LinkedIn blocks re-inviting a withdrawn person for ~3 weeks.
 *  - Weekly invite limits still apply.
 *  - Sent notes can't be edited (only withdrawn).
 */

/**
 * Attempt to withdraw a pending invitation to `username`.
 * Returns true only if withdrawal was confirmed. The deterministic CLI cannot
 * drive a browser, so it returns false (degraded). The agent-side
 * outreach-tracker skill performs the actual Chrome-MCP withdrawal and then
 * calls `mercury outreach update --state invite_ignored` directly.
 */
export async function withdrawInvitation(username: string): Promise<boolean> {
  // Deterministic CLI has no browser; signal "unconfirmed" so the caller blocks
  // the attempt but reports the invite may still be pending. The browser-driven
  // path lives in the outreach-tracker skill (docs/skills/outreach-tracker).
  void username;
  return false;
}
