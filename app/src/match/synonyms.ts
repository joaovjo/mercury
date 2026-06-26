/**
 * Canonical answer keys → the human-readable form labels they map to.
 *
 * Used by the portal-filler matcher (issue #7) to turn an ATS form's visible
 * field labels into Mercury `applicant_answers` keys. Synonyms are matched
 * case-insensitively against normalized labels.
 *
 * EEO/demographic keys are listed so the matcher can RECOGNIZE them — but they
 * are flagged `neverAutofill`, so the matcher reports them as deliberately
 * skipped (human-only at review time) rather than filling them.
 */
export type Category = "contact" | "eligibility" | "links" | "eeo" | "custom";

export interface KeySpec {
  key: string;
  category: Category;
  /** Lowercase phrases that, if contained in a normalized label, match this key. */
  synonyms: string[];
  /** EEO/demographic: recognized but never auto-filled. */
  neverAutofill?: boolean;
}

export const KEY_SPECS: KeySpec[] = [
  {
    key: "first_name",
    category: "contact",
    synonyms: ["first name", "given name", "legal first name"],
  },
  {
    key: "last_name",
    category: "contact",
    synonyms: ["last name", "surname", "family name", "legal last name"],
  },
  {
    key: "full_name",
    category: "contact",
    synonyms: ["full name", "your name", "name"],
  },
  {
    key: "email",
    category: "contact",
    synonyms: ["email", "email address", "e-mail", "work email"],
  },
  {
    key: "phone",
    category: "contact",
    synonyms: ["phone", "phone number", "mobile", "telephone", "cell"],
  },
  {
    key: "location",
    category: "contact",
    synonyms: ["location", "city", "current location", "where are you based"],
  },
  {
    key: "work_authorization",
    category: "eligibility",
    synonyms: [
      "work authorization",
      "authorized to work",
      "legally authorized to work",
      "work authorisation",
      "right to work",
    ],
  },
  {
    key: "requires_sponsorship",
    category: "eligibility",
    synonyms: [
      "require sponsorship",
      "need sponsorship",
      "visa sponsorship",
      "will you now or in the future require sponsorship",
      "immigration sponsorship",
    ],
  },
  {
    key: "salary_expectation",
    category: "eligibility",
    synonyms: [
      "salary expectation",
      "expected salary",
      "compensation expectation",
      "desired salary",
      "salary requirements",
    ],
  },
  {
    key: "notice_period",
    category: "eligibility",
    synonyms: ["notice period", "availability", "earliest start date", "start date"],
  },
  {
    key: "linkedin_url",
    category: "links",
    synonyms: ["linkedin", "linkedin url", "linkedin profile"],
  },
  {
    key: "github_url",
    category: "links",
    synonyms: ["github", "github url", "github profile"],
  },
  {
    key: "portfolio_url",
    category: "links",
    synonyms: ["portfolio", "website", "personal website", "portfolio url"],
  },
  {
    key: "eeo_gender",
    category: "eeo",
    neverAutofill: true,
    synonyms: ["gender", "gender identity"],
  },
  {
    key: "eeo_race",
    category: "eeo",
    neverAutofill: true,
    synonyms: ["race", "ethnicity", "race/ethnicity"],
  },
  {
    key: "eeo_veteran",
    category: "eeo",
    neverAutofill: true,
    synonyms: ["veteran", "veteran status", "protected veteran"],
  },
  {
    key: "eeo_disability",
    category: "eeo",
    neverAutofill: true,
    synonyms: ["disability", "disability status"],
  },
];

export const KEY_BY_NAME: Map<string, KeySpec> = new Map(
  KEY_SPECS.map((s) => [s.key, s]),
);
