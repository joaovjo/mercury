/**
 * Tests for buildSkillPrompt (issue #16) — the "Additional context" free-form
 * field appended to every skill's launch prompt.
 *
 * Acceptance criteria under test:
 *  - empty/blank `extra` → prompt is byte-identical to the un-nudged template
 *  - non-empty `extra` → a clearly delimited block is appended, for ALL skills
 *    including the generic `params.prompt` default case
 *  - no double-append; whitespace-only `extra` is a no-op
 */
import { describe, expect, test } from "bun:test";
import { buildSkillPrompt } from "./session.ts";

const SKILLS = [
  "job-scout",
  "recruiter-outreach",
  "profile-optimizer",
  "experience-bank",
  "resume-tailor",
  "deep-scout",
];

const DELIM = "\n\n---\nAdditional context from the user (honor this):\n";

describe("buildSkillPrompt — no extra (byte-identical)", () => {
  for (const skill of SKILLS) {
    test(`${skill}: omitted extra unchanged`, () => {
      const without = buildSkillPrompt(skill, { query: "q", company: "Acme Corp", jobIds: "1,2" });
      const withEmpty = buildSkillPrompt(skill, {
        query: "q",
        company: "Acme Corp",
        jobIds: "1,2",
        extra: "",
      });
      expect(withEmpty).toBe(without);
      expect(withEmpty).not.toContain("Additional context");
    });
  }

  test("default case with prompt, no extra", () => {
    expect(buildSkillPrompt("unknown-skill", { prompt: "do the thing" })).toBe("do the thing");
  });

  test("whitespace-only extra is a no-op", () => {
    const base = buildSkillPrompt("job-scout", { query: "q" });
    expect(buildSkillPrompt("job-scout", { query: "q", extra: "   \n\t " })).toBe(base);
  });
});

describe("buildSkillPrompt — with extra (delimited append)", () => {
  for (const skill of SKILLS) {
    test(`${skill}: appends delimited block once`, () => {
      const params = { query: "q", company: "Acme Corp", jobIds: "1,2", extra: "skip crypto" };
      const base = buildSkillPrompt(skill, { ...params, extra: "" });
      const out = buildSkillPrompt(skill, params);

      expect(out).toBe(`${base}${DELIM}skip crypto`);
      // exactly one delimiter (no double-append)
      expect(out.split("Additional context from the user").length - 1).toBe(1);
      expect(out.endsWith("skip crypto")).toBe(true);
    });
  }

  test("default (params.prompt) case also gets the extra appended", () => {
    const out = buildSkillPrompt("unknown-skill", { prompt: "do the thing", extra: "be terse" });
    expect(out).toBe(`do the thing${DELIM}be terse`);
  });

  test("extra is trimmed before appending", () => {
    const out = buildSkillPrompt("job-scout", { query: "q", extra: "  focus remote  " });
    expect(out.endsWith("focus remote")).toBe(true);
    expect(out).not.toContain("  focus remote  ");
  });

  test("multiline extra (e.g. pasted JD) is preserved", () => {
    const jd = "Role: Backend Engineer\nStack: Java, AWS\nRemote: yes";
    const out = buildSkillPrompt("job-scout", { query: "q", extra: jd });
    expect(out).toContain(jd);
  });
});
