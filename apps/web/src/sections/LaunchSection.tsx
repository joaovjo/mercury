import { useEffect, useState } from "react";
import { PlayIcon, XIcon, GearSixIcon, TerminalWindowIcon } from "@phosphor-icons/react";
import { FormattedMessage, useIntl } from "react-intl";
import { api, post, subscribe } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AcpProvider, AcpProvidersResponse } from "@/types";

interface LogEntry {
  kind: "msg" | "tool" | "status" | "plan" | "perm" | "err";
  text: string;
}

const skillOptions = [
  { id: "job-scout", labelId: "launch.skills.jobScout", defaultLabel: "Job Scout" },
  { id: "experience-bank", labelId: "launch.skills.experienceBank", defaultLabel: "Experience Bank (grill me)" },
  { id: "recruiter-outreach", labelId: "launch.skills.recruiterOutreach", defaultLabel: "Recruiter Outreach" },
  { id: "profile-optimizer", labelId: "launch.skills.profileOptimizer", defaultLabel: "Profile Optimizer" },
  { id: "resume-tailor", labelId: "launch.skills.resumeTailor", defaultLabel: "Resume Tailor" },
];

export function LaunchSection() {
  const intl = useIntl();
  const [providers, setProviders] = useState<AcpProvider[]>([]);
  const [provider, setProvider] = useState("opencode");
  const [model, setModel] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  // Skill parameters
  const [skill, setSkill] = useState("job-scout");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("São Paulo");
  const [company, setCompany] = useState("");
  const [jobIds, setJobIds] = useState("");
  const [extra, setExtra] = useState("");

  useEffect(() => {
    api<AcpProvidersResponse>("acp/providers")
      .then((p) => {
        setProviders(p.providers);
        setProvider(p.default);
      })
      .catch(() => {});

    const unsub = subscribe((msg) => {
      switch (msg.type) {
        case "acp-status":
          if (msg.status === "starting") {
            setRunning(true);
            pushLog("status", `▶ starting ${msg.skill} via ${msg.provider}`);
          } else if (msg.status === "running") {
            pushLog("status", `● running ${msg.skill}`);
          } else if (msg.status === "done") {
            setRunning(false);
            pushLog("status", `✓ ${msg.skill} finished`);
          }
          break;
        case "acp-update": {
          const u = msg.update?.update;
          if (!u) break;
          const k = u.sessionUpdate;
          if (k === "agent_message_chunk" && u.content?.text) {
            pushLog("msg", u.content.text, true);
          } else if (k === "tool_call") {
            pushLog("tool", `🔧 ${u.title ?? u.kind ?? "tool"}`);
          } else if (k === "tool_call_update" && u.status) {
            pushLog("tool", `   ${u.status}`);
          } else if (k === "plan") {
            pushLog("plan", `📋 plan updated`);
          }
          break;
        }
        case "acp-permission":
          pushLog("perm", `🔐 auto-approved a permission request`);
          break;
        case "acp-error":
          setRunning(false);
          pushLog("err", `✗ ${msg.message}`);
          break;
        case "acp-exit":
          setRunning(false);
          break;
      }
    });

    return unsub;
  }, []);

  function pushLog(kind: LogEntry["kind"], text: string, append = false) {
    setLog((prev) => {
      if (append && prev.length && prev[prev.length - 1]?.kind === "msg") {
        const last = prev[prev.length - 1]!;
        return [...prev.slice(0, -1), { kind, text: last.text + text }];
      }
      return [...prev, { kind, text }];
    });
  }

  async function handleLaunch() {
    setLog([]);
    const params = { query, location, company, jobIds, extra };
    const selectedProvider = providers.find((p) => p.id === provider);
    const selectedModel = selectedProvider?.models?.includes(model) ? model : undefined;
    try {
      await post("acp/run", { provider, model: selectedModel, skill, params });
    } catch (e: unknown) {
      pushLog("err", e instanceof Error ? e.message : String(e));
    }
  }

  async function handleCancel() {
    try {
      await post("acp/cancel", {});
    } catch {
      // Ignored
    }
  }

  const currentProviderObj = providers.find((p) => p.id === provider);
  const availableModels = currentProviderObj?.models ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          <FormattedMessage id="launch.title" defaultMessage="Launch" />
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          <FormattedMessage id="launch.subtitle" defaultMessage="Run a Mercury skill through your agent in real time" />
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[520px]">
        {/* Configuration panel */}
        <div className="lg:col-span-5 flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-border bg-muted/20">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <GearSixIcon className="size-4 text-muted-foreground" />{" "}
              <FormattedMessage id="launch.config.title" defaultMessage="Configuration" />
            </h2>
          </div>

          <div className="p-5 flex-1 space-y-4 overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <FormattedMessage id="launch.config.agent" defaultMessage="Agent" />
              </label>
              <Select value={provider} onValueChange={(val) => setProvider(val || "opencode")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={intl.formatMessage({ id: "launch.config.selectAgent", defaultMessage: "Select an Agent" })} />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <FormattedMessage id="launch.config.model" defaultMessage="Model" />
              </label>
              <Select value={model} onValueChange={(val) => setModel(val || "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={intl.formatMessage({ id: "launch.config.defaultModel", defaultMessage: "Default" })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    {intl.formatMessage({ id: "launch.config.defaultModel", defaultMessage: "Default" })}
                  </SelectItem>
                  {availableModels.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <FormattedMessage id="launch.config.skill" defaultMessage="Skill" />
              </label>
              <Select value={skill} onValueChange={(val) => setSkill(val || "job-scout")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={intl.formatMessage({ id: "launch.config.selectSkill", defaultMessage: "Select a skill" })} />
                </SelectTrigger>
                <SelectContent>
                  {skillOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {intl.formatMessage({ id: s.labelId, defaultMessage: s.defaultLabel })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Skill-specific params */}
            <div className="space-y-3 pt-2">
              {skill === "job-scout" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <FormattedMessage id="launch.config.query" defaultMessage="Query" />
                    </label>
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={intl.formatMessage({ id: "launch.config.queryPlaceholder", defaultMessage: "backend engineer" })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <FormattedMessage id="launch.config.location" defaultMessage="Location" />
                    </label>
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} />
                  </div>
                </>
              )}

              {skill === "recruiter-outreach" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <FormattedMessage id="launch.config.company" defaultMessage="Company" />
                    </label>
                    <Input
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder={intl.formatMessage({ id: "launch.config.companyPlaceholder", defaultMessage: "Airbnb" })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <FormattedMessage id="launch.config.location" defaultMessage="Location" />
                    </label>
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} />
                  </div>
                </>
              )}

              {skill === "resume-tailor" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <FormattedMessage id="launch.config.jobIds" defaultMessage="Job IDs (comma-sep)" />
                  </label>
                  <Input
                    value={jobIds}
                    onChange={(e) => setJobIds(e.target.value)}
                    placeholder={intl.formatMessage({ id: "launch.config.jobIdsPlaceholder", defaultMessage: "4393940374, 3969556398" })}
                  />
                </div>
              )}

              {skill === "profile-optimizer" && (
                <p className="text-xs text-muted-foreground">
                  <FormattedMessage
                    id="launch.config.profileOptimizerHint"
                    defaultMessage="No parameters required — audits your LinkedIn profile."
                  />
                </p>
              )}

              {skill === "experience-bank" && (
                <p className="text-xs text-muted-foreground">
                  <FormattedMessage
                    id="launch.config.experienceBankHint"
                    defaultMessage="No parameters required — interviews you interactively about achievements."
                  />
                </p>
              )}
            </div>

            {/* Additional context textarea */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span>
                  <FormattedMessage id="launch.config.extraContext" defaultMessage="Additional context" />
                </span>
                <span className="font-normal text-muted-foreground lowercase text-[0.7rem] flex items-center gap-2">
                  <FormattedMessage
                    id="launch.config.chars"
                    defaultMessage="{count} chars"
                    values={{ count: extra.length }}
                  />
                  {extra.trim() && (
                    <button type="button" onClick={() => setExtra("")} className="text-primary hover:underline">
                      <FormattedMessage id="common.clear" defaultMessage="clear" />
                    </button>
                  )}
                </span>
              </div>
              <Textarea
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder={intl.formatMessage({
                  id: "launch.config.extraPlaceholder",
                  defaultMessage: "e.g. focus on remote roles, skip crypto; or paste a job description here…",
                })}
                rows={3}
              />
            </div>
          </div>

          <div className="p-4 border-t border-border bg-muted/10">
            {running ? (
              <Button variant="destructive" onClick={handleCancel} className="w-full">
                <XIcon className="size-4 mr-2" />{" "}
                <FormattedMessage id="launch.config.cancel" defaultMessage="Cancel execution" />
              </Button>
            ) : (
              <Button onClick={handleLaunch} className="w-full">
                <PlayIcon className="size-4 mr-2" />{" "}
                <FormattedMessage id="launch.config.runAgent" defaultMessage="Run Agent" />
              </Button>
            )}
          </div>
        </div>

        {/* Live agent terminal / stream */}
        <div className="lg:col-span-7 flex flex-col rounded-xl border border-border bg-[#090a0b] text-neutral-200 overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-border/40 bg-neutral-900/60 flex items-center justify-between">
            <h2 className="text-xs font-mono text-neutral-400 flex items-center gap-2">
              <TerminalWindowIcon className="size-4" />{" "}
              <FormattedMessage id="launch.terminal.title" defaultMessage="agent_output.log" />
            </h2>
            {running && (
              <div className="flex items-center gap-2">
                <span className="text-[0.68rem] font-semibold text-emerald-400 uppercase tracking-wider">
                  <FormattedMessage id="launch.terminal.active" defaultMessage="Active" />
                </span>
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            )}
          </div>

          <div className="p-5 flex-1 overflow-y-auto font-mono text-xs leading-relaxed min-h-[340px] space-y-1">
            {log.length === 0 ? (
              <div className="text-neutral-500 py-4">
                <FormattedMessage
                  id="launch.terminal.empty"
                  defaultMessage="No run yet. Pick a skill and click Run Agent."
                />
              </div>
            ) : (
              log.map((entry, idx) => {
                const colorMap = {
                  msg: "text-neutral-300",
                  tool: "text-indigo-400 font-semibold",
                  status: "text-neutral-100",
                  plan: "text-sky-400",
                  perm: "text-amber-400",
                  err: "text-rose-400 font-semibold",
                };
                return (
                  <div key={idx} className={`whitespace-pre-wrap ${colorMap[entry.kind]}`}>
                    {entry.text}
                  </div>
                );
              })
            )}
            {running && <span className="inline-block size-2 bg-neutral-200 animate-pulse ml-1" />}
          </div>
        </div>
      </div>
    </div>
  );
}

