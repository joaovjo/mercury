export interface BreakdownItem {
  label: string;
  value: string;
}

export interface OverviewData {
  score: number | null;
  recruiters: number;
  accepted: number;
  replied: number;
  interviews: number;
  jobs: number;
  breakdown: BreakdownItem[];
}

export interface UpdateStatusData {
  updateAvailable: boolean;
  current: string;
  latest: string;
}

export interface Recruiter {
  id?: string | number;
  name: string;
  username?: string;
  company?: string;
  title?: string;
  location?: string;
  degree?: string;
  status: "pending" | "accepted" | "replied" | "interviewing" | "closed";
  note?: string;
}

export interface DueFollowUp {
  id?: string | number;
  name: string;
  username?: string;
  company: string;
  action: string;
  reason: string;
}

export interface SyncResponse {
  scanned: number;
  companiesQueried: number;
  changes: Array<{ name: string; username?: string }>;
  skipped?: string[];
}

export interface FunnelCounts {
  queued?: number;
  invited?: number;
  accepted?: number;
  followed_up?: number;
  engaged?: number;
  invite_ignored?: number;
  unresponsive?: number;
  do_not_contact?: number;
  [key: string]: number | undefined;
}

export interface DueActionItem {
  id?: string | number;
  person_name?: string;
  person_username?: string;
  company_name?: string;
  company_urn?: string;
  actionKind: "withdraw" | "followup" | "close";
  actionReason: string;
}

export interface InMailBudget {
  plan: string;
  credits_remaining: number;
  reserve_floor: number;
  credits_used_this_cycle: number;
  inmail_monthly_allotment: number;
}

export interface BlockedCompany {
  company_name?: string;
  company_urn?: string;
  count: number;
}

export interface OutreachData {
  funnel: FunnelCounts;
  due: DueActionItem[];
  budget: InMailBudget;
  blocked: BlockedCompany[];
}

export interface Job {
  id?: string | number;
  title?: string;
  company_name?: string;
  work_type?: string;
  fit?: "strong" | "good" | "stretch" | "bad" | string;
  status: string;
  link?: string;
}

export interface SearchReference {
  kind: "person" | "job" | string;
  url: string;
  text?: string;
}

export interface SearchResponse {
  raw?: string;
  sections?: {
    search_results?: string;
    [key: string]: string | undefined;
  };
  references?: {
    search_results?: SearchReference[];
    [key: string]: SearchReference[] | undefined;
  };
}

export interface ProfileMetric {
  captured_at: string;
  profile_views?: number | null;
  search_appearances?: number | null;
  connections?: number | null;
  [key: string]: string | number | null | undefined;
}

export interface ProfileSnapshot {
  hasScan: boolean;
  score?: number | null;
  profileViews?: number | null;
  searchAppearances?: number | null;
  connections?: number | null;
  capturedAt: string;
  breakdown: BreakdownItem[];
}

export interface Application {
  id?: string | number;
  job_id?: string | number | null;
  job_title?: string;
  company_name?: string;
  portal?: string;
  keyword_score?: number | null;
  status: "draft" | "filled" | "submitted" | "needs_input" | string;
  external_url?: string;
  resume_path?: string;
  cover_letter_path?: string;
  report_path?: string;
}

export interface ApplicantAnswer {
  id?: string | number;
  key: string;
  value?: string;
  category: "contact" | "links" | "eligibility" | "eeo" | "custom" | string;
}

export interface Interview {
  id?: string | number;
  company: string;
  scheduled_at?: string;
  stage?: string;
  status: string;
  notes?: string;
}

export interface ActivityItem {
  id?: string | number;
  ts: string | number;
  skill?: string;
  kind?: string;
  summary?: string;
}

export interface AcpProvider {
  id: string;
  displayName: string;
  models: string[];
}

export interface AcpProvidersResponse {
  providers: AcpProvider[];
  default: string;
}

export type WsMessage =
  | { type: "changed"; table: string }
  | {
      type: "update";
      event:
        | { type: "line"; text: string }
        | { type: "done"; code: number };
    }
  | {
      type: "acp-status";
      skill: string;
      provider: string;
      status: "starting" | "running" | "done";
    }
  | {
      type: "acp-update";
      update?: {
        update?: {
          sessionUpdate?: "agent_message_chunk" | "tool_call" | "tool_call_update" | "plan";
          content?: { text?: string };
          title?: string;
          kind?: string;
          status?: string;
        };
      };
    }
  | { type: "acp-permission" }
  | { type: "acp-log"; message?: string }
  | { type: "acp-error"; message: string }
  | { type: "acp-exit" };
