import { KEY_SPECS, type Category, type KeySpec } from "./synonyms.ts";

/**
 * Generic ATS-label → canonical-key matcher (issue #7, portal-filler Phase 2).
 *
 * Pure and deterministic so it can be unit-tested without a browser or DB. The
 * CLI layer supplies the form labels (from a Chrome MCP snapshot) and the set of
 * answer keys the user actually has stored, then acts on the classification.
 *
 * Matching is layered, most-confident first:
 *   1. exact    — normalized label equals a synonym (confidence 1.0)
 *   2. synonym  — normalized label contains a synonym phrase (0.9)
 *   3. fuzzy    — token overlap / small edit distance to a synonym (0.6–0.8)
 * Anything below the threshold is left unmatched and surfaced, never guessed.
 */

export type MatchReason = "exact" | "synonym" | "fuzzy";

export type SkipReason =
  | "eeo-human-only" // recognized EEO field — never auto-filled
  | "no-stored-answer" // matched a key, but user has no value for it
  | "no-match" // no confident key for this label
  | "ambiguous"; // top two candidates too close to call

export interface Matched {
  label: string;
  key: string;
  category: Category;
  value: string;
  confidence: number;
  reason: MatchReason;
}

export interface Unfilled {
  label: string;
  skip: SkipReason;
  /** Best-guess key when we recognized the field but won't/can't fill it. */
  key?: string;
}

export interface MatchResult {
  matched: Matched[];
  unfilled: Unfilled[];
}

/** Lowercase, strip required-markers/punctuation, collapse whitespace. */
export function normalize(label: string): string {
  return label
    .toLowerCase()
    .replace(/\*+/g, " ") // greenhouse "Field *" required markers
    .replace(/\(required\)|\(optional\)/g, " ")
    .replace(/[^a-z0-9+/ ]+/g, " ") // keep + and / (e.g. "race/ethnicity", "c++")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein edit distance (iterative, single-row). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = cur;
  }
  return prev[b.length]!;
}

interface Candidate {
  spec: KeySpec;
  confidence: number;
  reason: MatchReason;
}

/** Score a single normalized label against one key's synonyms. */
function scoreSpec(norm: string, spec: KeySpec): Candidate | null {
  let best: Candidate | null = null;
  const labelTokens = new Set(norm.split(" ").filter(Boolean));

  for (const syn of spec.synonyms) {
    const s = normalize(syn);
    if (norm === s) {
      return { spec, confidence: 1.0, reason: "exact" }; // can't beat exact
    }
    if (norm.includes(s) || s.includes(norm)) {
      // Weight by synonym specificity: a multi-word phrase ("require
      // sponsorship") is a far stronger signal than an incidental single-word
      // hit ("location" inside a long sentence). Caps below the 1.0 exact tier.
      const words = s.split(" ").filter(Boolean).length;
      const confidence = Math.min(0.98, 0.86 + 0.04 * (words - 1));
      best = pickBetter(best, { spec, confidence, reason: "synonym" });
      continue;
    }
    // Fuzzy: token overlap (Jaccard) and a normalized edit-distance ratio.
    const synTokens = new Set(s.split(" ").filter(Boolean));
    const overlap = [...synTokens].filter((t) => labelTokens.has(t)).length;
    const union = new Set([...labelTokens, ...synTokens]).size || 1;
    const jaccard = overlap / union;

    const dist = editDistance(norm, s);
    const ratio = 1 - dist / Math.max(norm.length, s.length, 1);

    const fuzzy = Math.max(jaccard, ratio);
    if (fuzzy >= 0.6) {
      best = pickBetter(best, {
        spec,
        confidence: Math.min(0.8, 0.6 + (fuzzy - 0.6)),
        reason: "fuzzy",
      });
    }
  }
  return best;
}

function pickBetter(a: Candidate | null, b: Candidate): Candidate {
  if (!a) return b;
  return b.confidence > a.confidence ? b : a;
}

/** Match-quality tier for ranking: exact beats synonym beats fuzzy. */
function tier(reason: MatchReason): number {
  return reason === "exact" ? 3 : reason === "synonym" ? 2 : 1;
}

export interface MatchOptions {
  /** Keys the user actually has a stored value for: key → value. */
  answers: Record<string, string>;
  /** Min confidence to accept a match. Default 0.6. */
  threshold?: number;
}

export function matchLabels(labels: string[], opts: MatchOptions): MatchResult {
  const threshold = opts.threshold ?? 0.6;
  const matched: Matched[] = [];
  const unfilled: Unfilled[] = [];

  for (const label of labels) {
    const norm = normalize(label);
    if (!norm) {
      unfilled.push({ label, skip: "no-match" });
      continue;
    }

    const candidates = KEY_SPECS.map((spec) => scoreSpec(norm, spec)).filter(
      (c): c is Candidate => c !== null && c.confidence >= threshold,
    );
    // Rank by tier (exact > synonym > fuzzy) first, then confidence, so a
    // strong match can't be derailed by a numerically-close fuzzy collision
    // (e.g. "...sponsorship...current location" must not lose to `location`).
    candidates.sort(
      (a, b) => tier(b.reason) - tier(a.reason) || b.confidence - a.confidence,
    );

    const top = candidates[0];
    if (!top) {
      unfilled.push({ label, skip: "no-match" });
      continue;
    }

    // Ambiguous only when a *different* key ties in the SAME tier within a tight
    // window. Synonym specificity (phrase length) already separates a strong
    // multi-word match from an incidental single-word collision; this catches
    // genuine ties (two equally-specific synonyms).
    const runnerUp = candidates.find((c) => c.spec.key !== top.spec.key);
    if (
      runnerUp &&
      tier(runnerUp.reason) === tier(top.reason) &&
      top.confidence - runnerUp.confidence < 0.03
    ) {
      unfilled.push({ label, skip: "ambiguous", key: top.spec.key });
      continue;
    }

    // EEO/demographic: recognized, but never auto-filled.
    if (top.spec.neverAutofill) {
      unfilled.push({ label, skip: "eeo-human-only", key: top.spec.key });
      continue;
    }

    const value = opts.answers[top.spec.key];
    if (value === undefined || value === "") {
      unfilled.push({ label, skip: "no-stored-answer", key: top.spec.key });
      continue;
    }

    matched.push({
      label,
      key: top.spec.key,
      category: top.spec.category,
      value,
      confidence: top.confidence,
      reason: top.reason,
    });
  }

  return { matched, unfilled };
}
