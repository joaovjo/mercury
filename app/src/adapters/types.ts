/**
 * Per-ATS adapters for portal-filler (issue #7, Phase 3).
 *
 * An adapter pairs the canonical `applicant_answers` keys with the *stable*
 * selectors and widget types of a specific ATS, so the skill can fill known
 * fields reliably instead of relying on label-matching alone. Selectors below
 * were verified against live Greenhouse (GitLab), Lever (Binance), and Ashby
 * (Ashby) application forms.
 *
 * Adapters do NOT touch per-posting custom questions (Greenhouse `question_*`,
 * Lever `cards[uuid][fieldN]`, Ashby random-uuid ids) — those vary per job and
 * are handled by the generic label matcher (`mercury match`).
 */

export type PortalId = "greenhouse" | "lever" | "ashby" | "generic";

/** How a field must be interacted with — drives the skill's Chrome MCP steps. */
export type Widget =
  | "text" // plain input: set value + dispatch input/change
  | "tel" // phone input, often an intl-tel widget that reformats — OK
  | "native-select" // a real <select>: select the option
  | "react-select" // Greenhouse combobox: click to open, click option
  | "listbox" // Ashby button/listbox: click to open, click option
  | "file"; // upload widget: click attach, upload, verify filename shown

export interface FieldSpec {
  /** Canonical applicant_answers key this field corresponds to. */
  key: string;
  /**
   * CSS selectors to try, in order. The first that exists on the page wins.
   * Selectors are intentionally specific to the ATS's stable markup.
   */
  selectors: string[];
  widget: Widget;
}

export interface Adapter {
  portal: PortalId;
  /** Substrings that, if present in the application URL host, select this ATS. */
  hostPatterns: string[];
  /** Stable, known fields for this ATS keyed to canonical answer keys. */
  fields: FieldSpec[];
  /** Human/agent-facing notes on quirks (file upload, dropdowns, captcha). */
  notes: string[];
}
