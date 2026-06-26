import { describe, expect, test } from "bun:test";
import { matchLabels, normalize, editDistance } from "./matcher.ts";

const ANSWERS = {
  email: "me@example.com",
  phone: "+55 11 99999-0000",
  requires_sponsorship: "No",
  linkedin_url: "https://linkedin.com/in/me",
  github_url: "https://github.com/me",
  // intentionally NO work_authorization value stored
  eeo_gender: "prefer not to say", // stored, but must never autofill
};

describe("normalize", () => {
  test("strips required markers and punctuation", () => {
    expect(normalize("Email Address *")).toBe("email address");
    expect(normalize("LinkedIn Profile (required)")).toBe("linkedin profile");
  });
  test("keeps + and / for things like race/ethnicity", () => {
    expect(normalize("Race/Ethnicity")).toBe("race/ethnicity");
  });
});

describe("editDistance", () => {
  test("basic cases", () => {
    expect(editDistance("abc", "abc")).toBe(0);
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("", "abc")).toBe(3);
  });
});

describe("matchLabels", () => {
  test("exact match fills from the answer store", () => {
    const r = matchLabels(["Email"], { answers: ANSWERS });
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0]!.key).toBe("email");
    expect(r.matched[0]!.value).toBe("me@example.com");
    expect(r.matched[0]!.reason).toBe("exact");
    expect(r.matched[0]!.confidence).toBe(1.0);
  });

  test("synonym phrase contained in a longer label", () => {
    const r = matchLabels(
      ["Will you now or in the future require sponsorship?"],
      { answers: ANSWERS },
    );
    expect(r.matched.map((m) => m.key)).toContain("requires_sponsorship");
  });

  test("links matched", () => {
    const r = matchLabels(["LinkedIn URL", "GitHub Profile"], {
      answers: ANSWERS,
    });
    const keys = r.matched.map((m) => m.key).sort();
    expect(keys).toEqual(["github_url", "linkedin_url"]);
  });

  test("EEO fields are recognized but NEVER auto-filled", () => {
    const r = matchLabels(["Gender", "Veteran Status", "Disability"], {
      answers: ANSWERS,
    });
    expect(r.matched).toHaveLength(0);
    const skips = r.unfilled.map((u) => u.skip);
    expect(skips.every((s) => s === "eeo-human-only")).toBe(true);
    // even though eeo_gender HAS a stored value, it must not be filled
    expect(r.matched.find((m) => m.key === "eeo_gender")).toBeUndefined();
  });

  test("recognized field with no stored answer is surfaced, not guessed", () => {
    const r = matchLabels(["Are you legally authorized to work?"], {
      answers: ANSWERS,
    });
    expect(r.matched).toHaveLength(0);
    expect(r.unfilled[0]!.skip).toBe("no-stored-answer");
    expect(r.unfilled[0]!.key).toBe("work_authorization");
  });

  test("unknown label is left unmatched", () => {
    const r = matchLabels(["Favorite programming koan"], { answers: ANSWERS });
    expect(r.matched).toHaveLength(0);
    expect(r.unfilled[0]!.skip).toBe("no-match");
  });

  test("fuzzy tolerates a typo", () => {
    const r = matchLabels(["Emial Adress"], { answers: ANSWERS });
    expect(r.matched.map((m) => m.key)).toContain("email");
    expect(r.matched[0]!.reason).toBe("fuzzy");
  });

  test("does not fill from an empty stored value", () => {
    const r = matchLabels(["Phone"], { answers: { phone: "" } });
    expect(r.matched).toHaveLength(0);
    expect(r.unfilled[0]!.skip).toBe("no-stored-answer");
  });
});
