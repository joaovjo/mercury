import { describe, expect, test } from "bun:test";
import { detectPortal, ADAPTERS, greenhouse, lever, ashby } from "./registry.ts";

describe("detectPortal", () => {
  test("greenhouse by host", () => {
    expect(
      detectPortal("https://job-boards.greenhouse.io/gitlab/jobs/8497793002").portal,
    ).toBe("greenhouse");
    expect(detectPortal("https://boards.greenhouse.io/acme").portal).toBe("greenhouse");
  });

  test("lever by host", () => {
    expect(
      detectPortal("https://jobs.lever.co/binance/8f870d45/apply").portal,
    ).toBe("lever");
  });

  test("ashby by host", () => {
    expect(
      detectPortal("https://jobs.ashbyhq.com/ashby/ce9f0432/application").portal,
    ).toBe("ashby");
  });

  test("unknown host falls back to generic", () => {
    expect(detectPortal("https://careers.example.com/apply/123").portal).toBe(
      "generic",
    );
  });

  test("tolerates a bare host string", () => {
    expect(detectPortal("jobs.lever.co").portal).toBe("lever");
  });

  test("tolerates a malformed url", () => {
    expect(detectPortal("not a url").portal).toBe("generic");
  });
});

describe("adapter field specs", () => {
  test("greenhouse exposes core ids + file widget", () => {
    const keys = greenhouse.fields.map((f) => f.key);
    expect(keys).toContain("email");
    expect(keys).toContain("first_name");
    const resume = greenhouse.fields.find((f) => f.key === "resume");
    expect(resume?.widget).toBe("file");
    const email = greenhouse.fields.find((f) => f.key === "email");
    expect(email?.selectors).toContain("#email");
  });

  test("lever keys fields by stable name attributes and uses full_name", () => {
    const keys = lever.fields.map((f) => f.key);
    expect(keys).toContain("full_name");
    expect(keys).not.toContain("first_name");
    const email = lever.fields.find((f) => f.key === "email");
    expect(email?.selectors[0]).toBe('input[name="email"]');
  });

  test("ashby uses _systemfield_* ids and full_name", () => {
    const name = ashby.fields.find((f) => f.key === "full_name");
    expect(name?.selectors).toContain("#_systemfield_name");
    const resume = ashby.fields.find((f) => f.key === "resume");
    expect(resume?.selectors).toContain("#_systemfield_resume");
  });

  test("every non-generic adapter has fields and notes", () => {
    for (const a of ADAPTERS) {
      if (a.portal === "generic") continue;
      expect(a.fields.length).toBeGreaterThan(0);
      expect(a.notes.length).toBeGreaterThan(0);
    }
  });

  test("generic adapter has no static fields", () => {
    const generic = ADAPTERS.find((a) => a.portal === "generic")!;
    expect(generic.fields).toHaveLength(0);
  });
});
