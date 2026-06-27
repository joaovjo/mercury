/**
 * Tests for recruiter/sync.ts (issue #15).
 *
 * Split into pure-function unit tests (normalizeName, usernameFromRef,
 * matchAccepted, parsePeopleResult — no I/O) and integration tests for
 * planSync/applySync against an in-memory DB with a stubbed detector.
 *
 * All names, usernames, and companies below are synthetic fixtures.
 */
import { describe, expect, test, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { SCHEMA_SQL } from "../db/schema.ts";
import {
  normalizeName,
  usernameFromRef,
  matchAccepted,
  parsePeopleResult,
  planSync,
  applySync,
  pendingRecruiters,
  type RecruiterRow,
  type DetectedPerson,
} from "./sync.ts";

// ── normalizeName ───────────────────────────────────────────────────────────

describe("normalizeName", () => {
  test("lowercases + strips diacritics", () =>
    expect(normalizeName("Renée Würst")).toBe("renee wurst"));
  test("collapses whitespace + drops punctuation", () =>
    expect(normalizeName("  Alex   Sample!! ")).toBe("alex sample"));
  test("empty stays empty", () => expect(normalizeName("   ")).toBe(""));
});

// ── usernameFromRef ───────────────────────────────────────────────────────────

describe("usernameFromRef", () => {
  test("extracts slug from /in/ path", () =>
    expect(usernameFromRef("/in/recruiter-one-000001/")).toBe("recruiter-one-000001"));
  test("extracts from full URL", () =>
    expect(usernameFromRef("https://www.linkedin.com/in/recruiter-two/")).toBe("recruiter-two"));
  test("decodes percent-encoding", () =>
    expect(usernameFromRef("re%C3%A9-recruiter-003")).toBe("reé-recruiter-003"));
  test("lowercases bare slug", () =>
    expect(usernameFromRef("Recruiter-Four")).toBe("recruiter-four"));
  test("null/empty → null", () => {
    expect(usernameFromRef(null)).toBeNull();
    expect(usernameFromRef("")).toBeNull();
    expect(usernameFromRef(undefined)).toBeNull();
  });
});

// ── matchAccepted ─────────────────────────────────────────────────────────────

function rec(partial: Partial<RecruiterRow> & { id: number; name: string }): RecruiterRow {
  return {
    username: null,
    company: "Acme Corp",
    degree: "2nd",
    status: "pending",
    ...partial,
  };
}

describe("matchAccepted", () => {
  test("matches by username (exact, normalized)", () => {
    const pending = [rec({ id: 1, name: "Recruiter One", username: "recruiter-one-000001" })];
    const detected: DetectedPerson[] = [
      { username: "/in/recruiter-one-000001/", name: "Recruiter One" },
    ];
    const changes = matchAccepted(pending, detected);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ id: 1, to: "accepted", matchedBy: "username" });
  });

  test("matches by name when username missing", () => {
    const pending = [rec({ id: 2, name: "Recruiter Two", username: null, company: "Beta Inc" })];
    const detected: DetectedPerson[] = [
      { username: "/in/recruiter-two/", name: "Recruiter Two" },
    ];
    const changes = matchAccepted(pending, detected);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ id: 2, matchedBy: "name" });
  });

  test("username match wins over name fallback (reports username)", () => {
    const pending = [rec({ id: 3, name: "Sample Person", username: "sample-person-123" })];
    const detected: DetectedPerson[] = [
      { username: "/in/sample-person-123/", name: "Totally Different" },
    ];
    const changes = matchAccepted(pending, detected);
    expect(changes[0].matchedBy).toBe("username");
  });

  test("no match → no change", () => {
    const pending = [rec({ id: 4, name: "Recruiter Four", username: "recruiter-four-000004" })];
    const detected: DetectedPerson[] = [{ username: "/in/someone-else/", name: "Someone Else" }];
    expect(matchAccepted(pending, detected)).toHaveLength(0);
  });

  test("ignores non-pending recruiters", () => {
    const pending = [
      rec({ id: 5, name: "Already Accepted", username: "x", status: "accepted" }),
      rec({ id: 6, name: "Interviewing One", username: "y", status: "interviewing" }),
    ];
    const detected: DetectedPerson[] = [
      { username: "/in/x/", name: "Already Accepted" },
      { username: "/in/y/", name: "Interviewing One" },
    ];
    expect(matchAccepted(pending, detected)).toHaveLength(0);
  });

  test("diacritic-insensitive name match", () => {
    const pending = [rec({ id: 7, name: "Renée Würst", username: null })];
    const detected: DetectedPerson[] = [{ username: "/in/rw/", name: "Renee Wurst" }];
    expect(matchAccepted(pending, detected)).toHaveLength(1);
  });
});

// ── parsePeopleResult ─────────────────────────────────────────────────────────

describe("parsePeopleResult", () => {
  test("extracts people from references.search_results", () => {
    const result = {
      references: {
        search_results: [
          { kind: "person", url: "/in/recruiter-one-000001/", text: "Recruiter One" },
          { kind: "person", url: "/in/recruiter-two/", text: "Recruiter Two" },
        ],
      },
    };
    const people = parsePeopleResult(result);
    expect(people).toHaveLength(2);
    expect(people[0]).toMatchObject({ username: "recruiter-one-000001", name: "Recruiter One" });
  });

  test("dedupes repeated slugs", () => {
    const result = {
      references: {
        search_results: [
          { url: "/in/dup/", text: "Dup One" },
          { url: "/in/dup/", text: "Dup One" },
        ],
      },
    };
    expect(parsePeopleResult(result)).toHaveLength(1);
  });

  test("empty / malformed → []", () => {
    expect(parsePeopleResult({})).toEqual([]);
    expect(parsePeopleResult(null)).toEqual([]);
    expect(parsePeopleResult({ references: {} })).toEqual([]);
  });
});

// ── planSync / applySync (in-memory DB + stub detector) ───────────────────────

function makeDb(): Database {
  const d = new Database(":memory:");
  d.exec("PRAGMA journal_mode = WAL;");
  d.exec(SCHEMA_SQL);
  return d;
}

function seed(d: Database, rows: Array<Partial<RecruiterRow> & { name: string }>) {
  const stmt = d.query(
    `INSERT INTO recruiters (name, username, company, degree, status)
     VALUES ($name, $username, $company, $degree, $status)`,
  );
  for (const r of rows) {
    stmt.run({
      $name: r.name,
      $username: r.username ?? null,
      $company: r.company ?? null,
      $degree: r.degree ?? "2nd",
      $status: r.status ?? "pending",
    });
  }
}

describe("planSync / applySync", () => {
  let d: Database;
  beforeEach(() => {
    d = makeDb();
  });

  test("plan groups by company and matches accepted, without writing", async () => {
    seed(d, [
      { name: "Recruiter One", username: "recruiter-one-000001", company: "Acme Corp" },
      { name: "Recruiter Two", username: "recruiter-two", company: "Acme Corp" },
      { name: "Recruiter Three", username: "recruiter-three", company: "Beta Inc" },
    ]);

    const detect = async (company: string): Promise<DetectedPerson[]> => {
      if (company === "Acme Corp")
        return [{ username: "/in/recruiter-one-000001/", name: "Recruiter One" }];
      if (company === "Beta Inc")
        return [{ username: "/in/recruiter-three/", name: "Recruiter Three" }];
      return [];
    };

    const plan = await planSync(d, detect);
    expect(plan.applied).toBe(false);
    expect(plan.scanned).toBe(3);
    expect(plan.companiesQueried).toBe(2);
    expect(plan.changes.map((c) => c.name).sort()).toEqual(["Recruiter One", "Recruiter Three"]);
    // Dry run must not mutate the DB.
    const stillPending = d
      .query("SELECT COUNT(*) AS n FROM recruiters WHERE status='pending'")
      .get() as { n: number };
    expect(stillPending.n).toBe(3);
  });

  test("apply transitions matched rows to accepted + sets accepted_at", async () => {
    seed(d, [{ name: "Recruiter One", username: "recruiter-one-000001", company: "Acme Corp" }]);
    const detect = async () => [{ username: "/in/recruiter-one-000001/", name: "Recruiter One" }];

    const plan = await planSync(d, detect);
    const applied = applySync(plan, d);
    expect(applied.applied).toBe(true);

    const row = d
      .query("SELECT status, accepted_at FROM recruiters WHERE name='Recruiter One'")
      .get() as { status: string; accepted_at: string | null };
    expect(row.status).toBe("accepted");
    expect(row.accepted_at).not.toBeNull();
  });

  test("recruiters without a company are skipped from search but counted as scanned", async () => {
    seed(d, [{ name: "No Company", username: "x", company: null }]);
    const detect = async () => [{ username: "/in/x/", name: "No Company" }];
    const plan = await planSync(d, detect);
    expect(plan.scanned).toBe(1);
    expect(plan.companiesQueried).toBe(0);
    expect(plan.changes).toHaveLength(0);
  });

  test("detector error for a company is reported as skipped, others proceed", async () => {
    seed(d, [
      { name: "Recruiter One", username: "recruiter-one-000001", company: "Acme Corp" },
      { name: "Broken Co Person", username: "bcp", company: "BrokenCo" },
    ]);
    const detect = async (company: string): Promise<DetectedPerson[]> => {
      if (company === "BrokenCo") throw new Error("MCP unreachable");
      return [{ username: "/in/recruiter-one-000001/", name: "Recruiter One" }];
    };
    const plan = await planSync(d, detect);
    expect(plan.skipped).toEqual(["BrokenCo"]);
    expect(plan.changes.map((c) => c.name)).toEqual(["Recruiter One"]);
  });

  test("apply is idempotent (re-running matches nothing new)", async () => {
    seed(d, [{ name: "Recruiter One", username: "recruiter-one-000001", company: "Acme Corp" }]);
    const detect = async () => [{ username: "/in/recruiter-one-000001/", name: "Recruiter One" }];

    applySync(await planSync(d, detect), d);
    // Second pass: the row is no longer pending, so plan finds nothing.
    const plan2 = await planSync(d, detect);
    expect(plan2.changes).toHaveLength(0);
    expect(pendingRecruiters(d)).toHaveLength(0);
  });
});
