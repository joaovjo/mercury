import { serve, type ServerWebSocket } from "bun";
import index from "../index.html";

const BACKEND_URL =
  process.env.MERCURY_URL ||
  `http://localhost:${process.env.BACKEND_PORT || "8080"}`;

// Mock database state for fallback when standalone
let mockOverview = {
  score: 84,
  recruiters: 18,
  accepted: 7,
  replied: 5,
  interviews: 2,
  jobs: 12,
  breakdown: [
    { label: "headline clarity", value: "strong" },
    { label: "featured projects", value: "ok" },
    { label: "keyword density", value: "good" },
    { label: "recommendations", value: "todo" },
    { label: "activity score", value: "strong" },
  ],
};

let mockRecruiters = [
  {
    id: 1,
    name: "Carolina Silva",
    username: "carolinasilva-recruiter",
    company: "Nubank",
    title: "Senior Tech Recruiter",
    location: "São Paulo, Brazil",
    degree: "1st",
    status: "interviewing",
    note: "Passed initial technical screening. System design round on Friday.",
  },
  {
    id: 2,
    name: "Alexandre Santos",
    username: "alexsantos",
    company: "Mercado Livre",
    title: "Lead Talent Acquisition",
    location: "São Paulo, Brazil",
    degree: "1st",
    status: "replied",
    note: "Sent job description for Senior Backend role (Golang/Java).",
  },
  {
    id: 3,
    name: "Mariana Costa",
    username: "marianacosta",
    company: "Brex",
    title: "Principal Recruiter",
    location: "Remote",
    degree: "2nd",
    status: "accepted",
    note: "Accepted invite yesterday. Follow up due today.",
  },
  {
    id: 4,
    name: "Felipe Almeida",
    username: "felipealmeida",
    company: "QuintoAndar",
    title: "Engineering Recruiter",
    location: "São Paulo, Brazil",
    degree: "2nd",
    status: "pending",
  },
  {
    id: 5,
    name: "Juliana Mendes",
    username: "julianamendes",
    company: "iFood",
    title: "Tech Sourcer",
    location: "Campinas, Brazil",
    degree: "3rd",
    status: "closed",
    note: "Position filled internally.",
  },
];

let mockDueFollowups = [
  {
    id: 1,
    name: "Mariana Costa",
    username: "marianacosta",
    company: "Brex",
    action: "FOLLOW UP",
    reason: "Invite accepted 2 days ago without initial pitch message",
  },
];

let mockOutreach = {
  funnel: {
    queued: 4,
    invited: 12,
    accepted: 7,
    followed_up: 5,
    engaged: 3,
    invite_ignored: 2,
    unresponsive: 1,
    do_not_contact: 0,
  },
  due: [
    {
      id: 1,
      person_name: "Mariana Costa",
      person_username: "marianacosta",
      company_name: "Brex",
      actionKind: "followup",
      actionReason: "Connection established 2 days ago — send customized pitch",
    },
    {
      id: 2,
      person_name: "Lucas Rocha",
      person_username: "lucasrocha",
      company_name: "Stone",
      actionKind: "withdraw",
      actionReason: "Invitation pending for over 21 days with no response",
    },
  ],
  budget: {
    plan: "Recruiter Lite",
    credits_remaining: 24,
    reserve_floor: 5,
    credits_used_this_cycle: 6,
    inmail_monthly_allotment: 30,
  },
  blocked: [
    { company_name: "Meta", count: 2 },
    { company_name: "Amazon", count: 1 },
  ],
};

let mockJobs = [
  {
    id: "1",
    title: "Staff Software Engineer - Core Platform",
    company_name: "Nubank",
    work_type: "Hybrid (São Paulo)",
    fit: "strong",
    status: "Saved",
    link: "https://www.linkedin.com/jobs/view/123456",
  },
  {
    id: "2",
    title: "Senior Backend Engineer (Go / Distributed Systems)",
    company_name: "Brex",
    work_type: "Remote (Brazil)",
    fit: "good",
    status: "Saved",
    link: "https://www.linkedin.com/jobs/view/234567",
  },
  {
    id: "3",
    title: "Lead Cloud Infrastructure Engineer",
    company_name: "Mercado Livre",
    work_type: "Hybrid",
    fit: "stretch",
    status: "Applied",
    link: "https://www.linkedin.com/jobs/view/345678",
  },
];

let mockApplications = [
  {
    id: "app-1",
    job_id: "1",
    job_title: "Staff Software Engineer",
    company_name: "Nubank",
    portal: "Greenhouse",
    keyword_score: 92,
    status: "submitted",
    external_url: "https://boards.greenhouse.io/nubank/jobs/123456",
    resume_path: "artifacts/resumes/nubank_staff_engineer.pdf",
    cover_letter_path: "artifacts/letters/nubank_cover.pdf",
    report_path: "artifacts/reports/nubank_fit_report.md",
  },
  {
    id: "app-2",
    job_id: "2",
    job_title: "Senior Backend Engineer",
    company_name: "Brex",
    portal: "Lever",
    keyword_score: 88,
    status: "filled",
    external_url: "https://jobs.lever.co/brex/234567",
    resume_path: "artifacts/resumes/brex_backend.pdf",
  },
  {
    id: "app-3",
    job_id: null,
    job_title: "Tech Lead - Payments",
    company_name: "Ebanx",
    portal: "Workday",
    keyword_score: 79,
    status: "draft",
    resume_path: "artifacts/resumes/ebanx_tech_lead.pdf",
  },
];

let mockAnswers = [
  { id: "1", key: "full_name", value: "João Victor", category: "contact" },
  { id: "2", key: "email", value: "joao.victor@example.com", category: "contact" },
  { id: "3", key: "phone", value: "+55 11 99999-9999", category: "contact" },
  { id: "4", key: "linkedin_url", value: "https://linkedin.com/in/joaovictor", category: "links" },
  { id: "5", key: "github_url", value: "https://github.com/joaovjo", category: "links" },
  { id: "6", key: "work_authorization", value: "Authorized to work in Brazil; eligible for Remote Global", category: "eligibility" },
  { id: "7", key: "gender", value: "Prefer not to disclose", category: "eeo" },
  { id: "8", key: "race_ethnicity", value: "Prefer not to disclose", category: "eeo" },
];

let mockInterviews = [
  {
    id: "1",
    company: "Nubank",
    scheduled_at: new Date(Date.now() + 86400000 * 3).toISOString(),
    stage: "System Design & Architecture",
    status: "confirmed",
    notes: "Review distributed transaction consistency patterns & Kafka partition design.",
  },
  {
    id: "2",
    company: "Brex",
    scheduled_at: new Date(Date.now() + 86400000 * 7).toISOString(),
    stage: "Technical Screening",
    status: "confirmed",
    notes: "Prepare STAR stories about latency reduction and cross-team orchestration.",
  },
];

let mockActivity = [
  {
    id: "1",
    ts: Date.now() - 1000 * 60 * 25,
    skill: "job-scout",
    summary: "Scouted 8 new backend roles in São Paulo and Remote",
  },
  {
    id: "2",
    ts: Date.now() - 1000 * 60 * 180,
    skill: "profile-optimizer",
    summary: "Audited profile visibility score (improved from 78 to 84)",
  },
  {
    id: "3",
    ts: Date.now() - 1000 * 60 * 60 * 24,
    skill: "resume-tailor",
    summary: "Generated customized resume for Nubank Staff Software Engineer",
  },
];

let mockMetrics = [
  { captured_at: new Date(Date.now() - 86400000 * 14).toISOString(), profile_views: 42, search_appearances: 18, connections: 490 },
  { captured_at: new Date(Date.now() - 86400000 * 7).toISOString(), profile_views: 68, search_appearances: 29, connections: 512 },
  { captured_at: new Date().toISOString(), profile_views: 95, search_appearances: 47, connections: 538 },
];

let mockProfileSnapshot = {
  hasScan: true,
  score: 84,
  profileViews: 95,
  searchAppearances: 47,
  connections: 538,
  capturedAt: new Date().toISOString(),
  breakdown: [
    { label: "headline clarity", value: "strong" },
    { label: "featured projects", value: "ok" },
    { label: "keyword density", value: "good" },
    { label: "recommendations", value: "todo" },
    { label: "activity score", value: "strong" },
  ],
};

const connectedSockets = new Set<ServerWebSocket<unknown>>();

function broadcast(msg: unknown) {
  const payload = JSON.stringify(msg);
  for (const ws of connectedSockets) {
    try {
      ws.send(payload);
    } catch {
      // Ignored
    }
  }
}

// Proxy or Fallback helper
async function handleApiRequest(path: string, req: Request): Promise<Response> {
  // Attempt proxy to real Mercury backend first if configured
  try {
    const url = new URL(req.url);
    const targetUrl = `${BACKEND_URL}/api/${path}${url.search}`;
    const proxyRes = await fetch(targetUrl, {
      method: req.method,
      headers: req.headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined,
    });
    if (proxyRes.ok || proxyRes.status < 500) {
      return proxyRes;
    }
  } catch {
    // Backend offline, proceed to fallback mocks
  }

  // Standalone mock handler
  const method = req.method.toUpperCase();

  if (path === "overview") return Response.json(mockOverview);
  if (path === "update-status") {
    return Response.json({
      updateAvailable: false,
      current: "v0.4.2",
      latest: "v0.4.2",
    });
  }
  if (path === "update" && method === "POST") {
    setTimeout(() => {
      broadcast({ type: "update", event: { type: "line", text: "Compiling binary...\n" } });
      broadcast({ type: "update", event: { type: "done", code: 0 } });
    }, 500);
    return Response.json({ ok: true });
  }
  if (path === "recruiters") return Response.json(mockRecruiters);
  if (path === "recruiters/due") return Response.json(mockDueFollowups);
  if (path === "recruiters/sync" && method === "POST") {
    return Response.json({
      scanned: 4,
      companiesQueried: 3,
      changes: [{ name: "Mariana Costa", username: "marianacosta" }],
      skipped: [],
    });
  }
  if (path === "outreach") return Response.json(mockOutreach);
  if (path === "jobs") return Response.json(mockJobs);
  if (path.startsWith("search/")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, string>;
    return Response.json({
      sections: {
        search_results: `Scouted roles matching '${body.keywords || "engineer"}' in '${body.location || "São Paulo"}':\n1. Staff Software Engineer - Nubank\n2. Senior Backend Engineer - Brex\n3. Cloud Platform Lead - Mercado Livre`,
      },
      references: {
        search_results: [
          { kind: "job", url: "/jobs/view/123456", text: "Nubank - Staff Software Engineer" },
          { kind: "job", url: "/jobs/view/234567", text: "Brex - Senior Backend Engineer" },
        ],
      },
    });
  }
  if (path === "metrics") return Response.json(mockMetrics);
  if (path === "profile-snapshot") return Response.json(mockProfileSnapshot);
  if (path === "applications") return Response.json(mockApplications);
  if (path === "answers") return Response.json(mockAnswers);
  if (path === "answer" && method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { key?: string; value?: string; category?: string };
    if (body.key) {
      const idx = mockAnswers.findIndex((a) => a.key === body.key);
      if (idx >= 0) {
        mockAnswers[idx] = { id: mockAnswers[idx]!.id, key: body.key, value: body.value, category: body.category || mockAnswers[idx]!.category };
      } else {
        mockAnswers.push({ id: String(Date.now()), key: body.key, value: body.value, category: body.category || "custom" });
      }
      broadcast({ type: "changed", table: "applicant_answers" });
    }
    return Response.json({ ok: true });
  }
  if (path === "interviews") return Response.json(mockInterviews);
  if (path === "activity") return Response.json(mockActivity);
  if (path === "acp/providers") {
    return Response.json({
      providers: [
        { id: "opencode", displayName: "OpenCode Interpreter", models: ["claude-3-7-sonnet", "gpt-4o", "gemini-2.0-flash"] },
        { id: "anthropic", displayName: "Claude Code", models: ["claude-3-7-sonnet", "claude-3-5-sonnet"] },
      ],
      default: "opencode",
    });
  }
  if (path === "acp/run" && method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { skill?: string; provider?: string };
    const skill = body.skill || "job-scout";
    setTimeout(() => {
      broadcast({ type: "acp-status", skill, provider: body.provider || "opencode", status: "starting" });
      setTimeout(() => {
        broadcast({ type: "acp-status", skill, provider: body.provider || "opencode", status: "running" });
        broadcast({
          type: "acp-update",
          update: {
            update: {
              sessionUpdate: "agent_message_chunk",
              content: { text: `Running ${skill} agent...\nInitializing browser session and scanning LinkedIn...\n` },
            },
          },
        });
        setTimeout(() => {
          broadcast({
            type: "acp-update",
            update: {
              update: {
                sessionUpdate: "tool_call",
                title: "mcp__linkedin__search_jobs",
              },
            },
          });
          setTimeout(() => {
            broadcast({ type: "acp-status", skill, provider: body.provider || "opencode", status: "done" });
            broadcast({ type: "changed", table: skill === "profile-optimizer" ? "profile_metrics" : "jobs" });
          }, 1500);
        }, 1200);
      }, 800);
    }, 200);
    return Response.json({ ok: true });
  }
  if (path === "acp/cancel" && method === "POST") {
    broadcast({ type: "acp-exit" });
    return Response.json({ ok: true });
  }

  return Response.json({ error: `Not found: /api/${path}` }, { status: 404 });
}

const server = serve({
  routes: {
    // Dynamic catch-all API handler
    "/api/*": async (req) => {
      const url = new URL(req.url);
      const path = url.pathname.replace(/^\/api\//, "");
      return handleApiRequest(path, req);
    },

    // WebSocket upgrade handler
    "/ws": (req, srv) => {
      if (srv.upgrade(req)) {
        return; // Upgraded successfully
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    },

    // Catch-all SPA route: serve index.html
    "/*": index,
  },

  websocket: {
    open(ws) {
      connectedSockets.add(ws);
    },
    message(_ws, _message) {
      // Incoming message handling if needed
    },
    close(ws) {
      connectedSockets.delete(ws);
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Mercury Web Server running at ${server.url}`);
