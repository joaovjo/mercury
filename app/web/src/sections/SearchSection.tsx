import { useState } from "react";
import { MagnifyingGlassIcon, ArrowSquareOutIcon, ArrowClockwiseIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TOKEN } from "@/lib/api";
import type { SearchResponse } from "@/types";

export function SearchSection() {
  const [mode, setMode] = useState<"jobs" | "people">("jobs");
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<SearchResponse | null>(null);

  async function handleSearch() {
    if (!keywords.trim()) return;
    setLoading(true);
    setError(null);
    setRaw(null);

    const path = mode === "jobs" ? "jobs" : "people";
    const body = mode === "jobs" ? { keywords, location } : { keywords, company, location };
    const query = TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : "";

    try {
      const res = await fetch(`/api/search/${path}${query}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setRaw(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const resultText =
    raw?.sections?.search_results ??
    raw?.raw ??
    (raw ? JSON.stringify(raw, null, 2) : null);

  const resultRefs = raw?.references?.search_results ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Search</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Instant LinkedIn search · deep scout hand-off to the agent
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
        <Tabs
          value={mode}
          onValueChange={(val) => setMode(val as "jobs" | "people")}
          className="w-fit"
        >
          <TabsList>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
            <TabsTrigger value="people">Recruiters / People</TabsTrigger>
          </TabsList>
        </Tabs>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end pt-2"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Keywords
            </label>
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder={mode === "jobs" ? "software engineer" : "recruiter engineer Brazil"}
            />
          </div>

          {mode === "people" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Company
              </label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Airbnb"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Location
            </label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="São Paulo"
            />
          </div>

          <Button type="submit" disabled={loading || !keywords.trim()} className="w-full">
            {loading ? (
              <>
                <ArrowClockwiseIcon className="size-4 mr-2 animate-spin" /> Searching…
              </>
            ) : (
              <>
                <MagnifyingGlassIcon className="size-4 mr-2" /> Search
              </>
            )}
          </Button>
        </form>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-5 shadow-xs">
          <strong className="text-destructive font-semibold">Search failed.</strong>
          <p className="text-muted-foreground text-sm mt-1">{error}</p>
          <p className="text-muted-foreground text-xs mt-2">
            Make sure the LinkedIn MCP is reachable and you're logged in to LinkedIn in your browser session.
          </p>
        </div>
      )}

      {raw && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
          <h3 className="text-base font-semibold text-foreground">Results</h3>

          {resultRefs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {resultRefs
                .filter((r) => r.kind === "person" || r.kind === "job")
                .map((ref, idx) => (
                  <a
                    key={idx}
                    href={`https://www.linkedin.com${ref.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground hover:bg-accent transition-colors"
                  >
                    <span>{ref.text ?? ref.url}</span>
                    <ArrowSquareOutIcon className="size-3 text-muted-foreground" />
                  </a>
                ))}
            </div>
          )}

          <pre className="rounded-lg border border-border bg-muted/30 p-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-[480px] overflow-y-auto leading-relaxed">
            {resultText}
          </pre>
        </div>
      )}
    </div>
  );
}
