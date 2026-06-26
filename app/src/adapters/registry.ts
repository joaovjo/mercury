import type { Adapter } from "./types.ts";

/**
 * Greenhouse — verified against the live GitLab board (job-boards.greenhouse.io).
 * Core fields have stable lowercase ids; phone is an intl-tel-input widget;
 * country / yes-no screeners and EEO are react-select comboboxes; the resume is
 * an async S3-backed upload behind an "Attach" button.
 */
export const greenhouse: Adapter = {
  portal: "greenhouse",
  hostPatterns: ["greenhouse.io", "boards.greenhouse.io", "job-boards.greenhouse.io"],
  fields: [
    { key: "first_name", selectors: ["#first_name"], widget: "text" },
    { key: "last_name", selectors: ["#last_name"], widget: "text" },
    { key: "email", selectors: ["#email"], widget: "text" },
    { key: "phone", selectors: ["#phone"], widget: "tel" },
    { key: "resume", selectors: ["#resume", 'input[type=file][id=resume]'], widget: "file" },
  ],
  notes: [
    "Core text fields (#first_name/#last_name/#email) fill reliably; set value + dispatch input & change.",
    "#phone is an intl-tel-input that reformats the number — the reformatted value is correct.",
    "Custom + screener questions are #question_<id>; many are react-select comboboxes (click to open, click option), not text.",
    "Resume is an async S3 upload behind an 'Attach' button; after upload verify the filename is shown, else ask the user to attach manually.",
    "EEO block (Gender/Hispanic/Veteran/Disability) are react-select — never auto-fill; leave to the human.",
    "A reCAPTCHA may gate submission — out of scope.",
  ],
};

/**
 * Lever — verified against the live Binance board (jobs.lever.co).
 * Fields are keyed by stable `name` attributes (not ids); dropdowns are native
 * <select>; resume input is #resume-upload-input (name=resume).
 */
export const lever: Adapter = {
  portal: "lever",
  hostPatterns: ["lever.co", "jobs.lever.co"],
  fields: [
    { key: "full_name", selectors: ['input[name="name"]'], widget: "text" },
    { key: "email", selectors: ['input[name="email"]'], widget: "text" },
    { key: "phone", selectors: ['input[name="phone"]'], widget: "text" },
    { key: "location", selectors: ['input[name="location"]', "#location-input"], widget: "text" },
    { key: "current_company", selectors: ['input[name="org"]'], widget: "text" },
    {
      key: "linkedin_url",
      selectors: ['input[name="urls[LinkedIn]"]', 'input[name^="urls["]'],
      widget: "text",
    },
    {
      key: "resume",
      selectors: ["#resume-upload-input", 'input[name="resume"][type=file]'],
      widget: "file",
    },
  ],
  notes: [
    "Lever uses stable name attributes: name, email, phone, location, org, urls[...].",
    "Lever 'name' is a single full-name field — use full_name, not first/last.",
    "The links field name is urls[<label>] (e.g. urls[LinkedIn account or any other links]); match by name^='urls['.",
    "Custom questions are cards[<uuid>][fieldN] (native <select>, radio, or textarea) — per-posting, handle via generic match, not statically.",
    "Resume file input is a real <input type=file> (#resume-upload-input) — upload_file works directly.",
  ],
};

/**
 * Ashby — verified against the live Ashby board (jobs.ashbyhq.com).
 * System fields use _systemfield_* ids; custom questions use random-uuid ids;
 * single-select questions render as buttons/listbox, multi-select as checkboxes.
 */
export const ashby: Adapter = {
  portal: "ashby",
  hostPatterns: ["ashbyhq.com", "jobs.ashbyhq.com"],
  fields: [
    { key: "full_name", selectors: ["#_systemfield_name"], widget: "text" },
    { key: "email", selectors: ["#_systemfield_email"], widget: "text" },
    { key: "phone", selectors: ["#_systemfield_phone"], widget: "text" },
    { key: "resume", selectors: ["#_systemfield_resume"], widget: "file" },
  ],
  notes: [
    "Ashby system fields are #_systemfield_name / _email / _phone / _resume.",
    "Ashby 'Name' is a single full-name field — use full_name.",
    "Custom questions use random-uuid ids; single-select renders as a button/listbox (click to open, click option), multi-select as checkboxes.",
    "Resume is #_systemfield_resume (file input) behind an 'Upload File' button.",
  ],
};

/** Generic fallback — no known selectors; rely entirely on `mercury match`. */
export const generic: Adapter = {
  portal: "generic",
  hostPatterns: [],
  fields: [],
  notes: [
    "Unknown ATS: no stable selectors. Snapshot the form, collect labels, and use `mercury match` to map labels to answers, then fill by snapshot uid.",
  ],
};

export const ADAPTERS: Adapter[] = [greenhouse, lever, ashby, generic];

/**
 * Pick the ATS adapter for an application URL by matching its host against each
 * adapter's hostPatterns. Falls back to the generic adapter when unknown.
 */
export function detectPortal(url: string): Adapter {
  let host = "";
  try {
    host = new URL(url).host.toLowerCase();
  } catch {
    host = url.toLowerCase(); // tolerate a bare host string
  }
  for (const a of ADAPTERS) {
    if (a.portal === "generic") continue;
    if (a.hostPatterns.some((p) => host.includes(p))) return a;
  }
  return generic;
}
