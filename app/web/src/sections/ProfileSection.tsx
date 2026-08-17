import { useEffect, useState } from "react";
import { ScanIcon, ArrowClockwiseIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useResource } from "@/hooks/useResource";
import { useLiveTable } from "@/hooks/useLiveTable";
import { api, post, subscribe } from "@/lib/api";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import type { ProfileMetric, ProfileSnapshot } from "@/types";

interface CombinedProfileData {
  metrics: ProfileMetric[];
  snapshot: ProfileSnapshot | null;
}

function pillVariant(value: string): "default" | "destructive" | "secondary" {
  const v = String(value).toLowerCase();
  if (["true", "strong", "good", "ok", "yes", "done", "set"].some((s) => v.includes(s))) return "default";
  if (["weak", "missing", "empty", "none", "no", "false", "todo"].some((s) => v.includes(s))) return "destructive";
  return "secondary";
}

const chartConfig = {
  profile_views: {
    label: "Profile Views",
    color: "hsl(var(--chart-1, 260 80% 65%))",
  },
  search_appearances: {
    label: "Search Appearances",
    color: "hsl(var(--chart-2, 220 70% 55%))",
  },
  connections: {
    label: "Connections",
    color: "hsl(var(--chart-3, 150 70% 45%))",
  },
} satisfies ChartConfig;

export function ProfileSection() {
  const data = useResource<CombinedProfileData>(
    async () => {
      const [metrics, snapshot] = await Promise.all([
        api<ProfileMetric[]>("metrics").catch(() => []),
        api<ProfileSnapshot | null>("profile-snapshot").catch(() => null),
      ]);
      return { metrics, snapshot };
    },
    { metrics: [], snapshot: null }
  );

  useLiveTable("profile_metrics", data.reload);

  const [scanning, setScanning] = useState(false);
  const [scanLog, setScanLog] = useState<string[]>([]);
  const [provider, setProvider] = useState("opencode");

  useEffect(() => {
    api<{ default: string }>("acp/providers")
      .then((p) => setProvider(p.default))
      .catch(() => {});

    const unsub = subscribe((msg) => {
      switch (msg.type) {
        case "acp-status":
          if (msg.skill !== "profile-optimizer") return;
          if (msg.status === "starting") {
            setScanning(true);
            setScanLog(["▶ starting profile scan…"]);
          } else if (msg.status === "running") {
            setScanLog((prev) => [...prev, "● scanning your profile"]);
          } else if (msg.status === "done") {
            setScanning(false);
            setScanLog((prev) => [...prev, "✓ scan complete"]);
            data.reload();
          }
          break;
        case "acp-update": {
          if (!scanning) return;
          const u = msg.update?.update;
          const k = u?.sessionUpdate;
          if (k === "tool_call" && (u.title || u.kind)) {
            setScanLog((prev) => [...prev, `🔧 ${u.title ?? u.kind}`]);
          }
          break;
        }
        case "acp-error":
          if (scanning) {
            setScanning(false);
            setScanLog((prev) => [...prev, `✗ ${msg.message}`]);
          }
          break;
        case "acp-exit":
          setScanning(false);
          break;
      }
    });

    return unsub;
  }, [scanning, data]);

  async function handleScan() {
    setScanLog([]);
    setScanning(true);
    try {
      await post("acp/run", { provider, skill: "profile-optimizer", params: {} });
    } catch (e: unknown) {
      setScanning(false);
      setScanLog([`✗ ${e instanceof Error ? e.message : String(e)}`]);
    }
  }

  const metrics = data.data?.metrics ?? [];
  const snapshot = data.data?.snapshot ?? null;
  const hasScan = snapshot?.hasScan;
  const breakdown = snapshot?.breakdown ?? [];

  const chartData = metrics.map((m) => ({
    date: new Date(m.captured_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    profile_views: m.profile_views ?? 0,
    search_appearances: m.search_appearances ?? 0,
    connections: m.connections ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">Recruiter-search visibility and audit breakdown</p>
        </div>
        <Button onClick={handleScan} disabled={scanning} className="shrink-0">
          {scanning ? (
            <>
              <ArrowClockwiseIcon className="size-4 mr-2 animate-spin" /> Scanning…
            </>
          ) : (
            <>
              <ScanIcon className="size-4 mr-2" />
              {hasScan ? "Re-scan profile" : "Scan profile"}
            </>
          )}
        </Button>
      </div>

      {scanLog.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-1 shadow-xs">
          <div className="flex items-center gap-2 mb-2 font-medium text-xs text-muted-foreground uppercase tracking-wider">
            <span>Profile scan log</span>
            {scanning && <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />}
          </div>
          <div className="font-mono text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto bg-muted/30 p-3 rounded-md border border-border">
            {scanLog.map((line, idx) => (
              <div key={idx} className="leading-relaxed">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.status === "loading" && <LoadingState rows={4} />}
      {data.status === "error" && <ErrorState error={data.error} onretry={data.reload} />}

      {data.status === "ready" && !hasScan && (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground shadow-xs">
          <p className="text-sm">
            No profile scan yet. Click <strong className="text-foreground">Scan profile</strong> above to run the{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-primary">profile-optimizer</code> skill.
          </p>
        </div>
      )}

      {data.status === "ready" && hasScan && (
        <>
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="text-xs text-muted-foreground font-medium">Score</div>
              <div className="text-3xl font-bold tracking-tight mt-2 text-primary">{snapshot?.score ?? "—"}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="text-xs text-muted-foreground font-medium">Views</div>
              <div className="text-3xl font-bold tracking-tight mt-2">{snapshot?.profileViews ?? "—"}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="text-xs text-muted-foreground font-medium">Search Appears/wk</div>
              <div className="text-3xl font-bold tracking-tight mt-2">{snapshot?.searchAppearances ?? "—"}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="text-xs text-muted-foreground font-medium">Connections</div>
              <div className="text-3xl font-bold tracking-tight mt-2 text-emerald-500">{snapshot?.connections ?? "—"}</div>
            </div>
          </div>

          {/* Audit Breakdown Panel */}
          {breakdown.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground">Audit breakdown</h3>
                {snapshot?.capturedAt && (
                  <span className="text-xs text-muted-foreground">
                    last scan {new Date(snapshot.capturedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="divide-y divide-border/60">
                {breakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="capitalize text-muted-foreground">{item.label}</span>
                    {item.value && (
                      <Badge variant={pillVariant(item.value)} className="capitalize text-[0.7rem] px-2 py-0.5">
                        {item.value}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metrics Trend Chart */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <TrendUpIcon className="size-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">Trend History</h3>
            </div>
            {metrics.length <= 1 ? (
              <p className="text-xs text-muted-foreground mb-4">
                Only one snapshot so far. The trend graph will chart your evolution over time as you perform scans.
              </p>
            ) : null}
            <div className="h-[280px] w-full pt-4">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="date" className="text-xs fill-muted-foreground" tickLine={false} />
                    <YAxis className="text-xs fill-muted-foreground" tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="profile_views"
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="search_appearances"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="connections"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
