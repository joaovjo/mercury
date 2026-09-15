import { useEffect, useState } from "react";
import {
  RocketLaunchIcon,
  SquaresFourIcon,
  UserIcon,
  MagnifyingGlassIcon,
  UsersIcon,
  PaperPlaneTiltIcon,
  BriefcaseIcon,
  FileTextIcon,
  ClipboardTextIcon,
  CalendarCheckIcon,
  ActivityIcon,
  DownloadSimpleIcon,
  ListIcon,
} from "@phosphor-icons/react";
import { FormattedMessage, useIntl } from "react-intl";
import { useResource } from "@/hooks/useResource";
import { useLiveTable } from "@/hooks/useLiveTable";
import { useTheme } from "@/components/theme-provider";
import { api, onConnection, post, subscribe } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ModeToggle } from "@/components/mode-toggle";
import { LocaleToggle } from "@/components/locale-toggle";

import { OverviewSection } from "@/sections/OverviewSection";
import { ProfileSection } from "@/sections/ProfileSection";
import { SearchSection } from "@/sections/SearchSection";
import { LaunchSection } from "@/sections/LaunchSection";
import { RecruitersSection } from "@/sections/RecruitersSection";
import { OutreachSection } from "@/sections/OutreachSection";
import { JobsSection } from "@/sections/JobsSection";
import { ApplicationsSection } from "@/sections/ApplicationsSection";
import { AnswersSection } from "@/sections/AnswersSection";
import { InterviewsSection } from "@/sections/InterviewsSection";
import { ActivitySection } from "@/sections/ActivitySection";

import type { OverviewData, UpdateStatusData } from "@/types";

const NAV_ITEMS = [
  { id: "overview", labelId: "nav.overview", defaultLabel: "Overview", icon: SquaresFourIcon },
  { id: "profile", labelId: "nav.profile", defaultLabel: "Profile", icon: UserIcon },
  { id: "search", labelId: "nav.search", defaultLabel: "Search", icon: MagnifyingGlassIcon },
  { id: "launch", labelId: "nav.launch", defaultLabel: "Launch", icon: RocketLaunchIcon },
  { id: "recruiters", labelId: "nav.recruiters", defaultLabel: "Recruiters", icon: UsersIcon },
  { id: "outreach", labelId: "nav.outreach", defaultLabel: "Outreach", icon: PaperPlaneTiltIcon },
  { id: "jobs", labelId: "nav.jobs", defaultLabel: "Jobs", icon: BriefcaseIcon },
  { id: "applications", labelId: "nav.applications", defaultLabel: "Applications", icon: FileTextIcon },
  { id: "answers", labelId: "nav.answers", defaultLabel: "Answers", icon: ClipboardTextIcon },
  { id: "interviews", labelId: "nav.interviews", defaultLabel: "Interviews", icon: CalendarCheckIcon },
  { id: "activity", labelId: "nav.activity", defaultLabel: "Activity", icon: ActivityIcon },
];

export function App() {
  const intl = useIntl();
  const [active, setActive] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace(/^#/, "");
      if (NAV_ITEMS.some((n) => n.id === hash)) return hash;
    }
    return "overview";
  });

  const [connected, setConnected] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateOutput, setUpdateOutput] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme, isDark } = useTheme();

  const overview = useResource<OverviewData | null>(() => api<OverviewData>("overview"), null);
  const updateStatus = useResource<UpdateStatusData | null>(
    () => api<UpdateStatusData>("update-status"),
    null
  );

  useLiveTable(
    ["recruiters", "jobs", "interviews", "applications", "profile_metrics"],
    overview.reload
  );

  useEffect(() => {
    return onConnection((c) => setConnected(c));
  }, []);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type !== "update") return;
      const event = msg.event;
      if (event.type === "line") {
        setUpdateOutput((prev) => (prev + event.text).slice(-2000));
      } else if (event.type === "done") {
        setUpdating(false);
        setUpdateOutput((prev) =>
          prev +
          (event.code === 0
            ? `\n${intl.formatMessage({ id: "app.update.complete", defaultMessage: "Update complete. Restart the dashboard to use the new binary." })}\n`
            : `\n${intl.formatMessage({ id: "app.update.failed", defaultMessage: "Update failed with exit code {code}." }, { code: event.code })}\n`)
        );
        updateStatus.reload();
      }
    });
  }, [updateStatus, intl]);

  function handleNavigate(id: string) {
    setActive(id);
    setMobileOpen(false);
    if (typeof window !== "undefined") {
      window.location.hash = id;
    }
  }

  async function handleStartUpdate() {
    setUpdating(true);
    setUpdateOutput(intl.formatMessage({ id: "app.update.starting", defaultMessage: "Starting update...\n" }));
    try {
      await post("update");
    } catch (err: unknown) {
      setUpdating(false);
      setUpdateOutput((prev) => `${prev}${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  const ov = overview.data;
  const activeItem = NAV_ITEMS.find((n) => n.id === active);
  const activeLabel = activeItem
    ? intl.formatMessage({ id: activeItem.labelId, defaultMessage: activeItem.defaultLabel })
    : "Overview";
  const updateAvailable =
    updateStatus.status === "ready" && updateStatus.data?.updateAvailable;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-card border-r border-border p-4 select-none">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2 py-3 mb-3">
        <div className="size-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
          <RocketLaunchIcon className="size-5" />
        </div>
        <div className="leading-tight">
          <h1 className="text-base font-bold tracking-tight text-foreground">
            <FormattedMessage id="app.brand.name" defaultMessage="Mercury" />
          </h1>
          <p className="text-xs text-muted-foreground">
            <FormattedMessage id="app.brand.tagline" defaultMessage="AI Job Companion" />
          </p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          const label = intl.formatMessage({ id: item.labelId, defaultMessage: item.defaultLabel });
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
              {item.id === "recruiters" && ov?.recruiters != null && (
                <span className={`text-[0.68rem] px-1.5 py-0.2 rounded-full ${isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {ov.recruiters}
                </span>
              )}
              {item.id === "interviews" && ov?.interviews != null && (
                <span className={`text-[0.68rem] px-1.5 py-0.2 rounded-full ${isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {ov.interviews}
                </span>
              )}
              {item.id === "jobs" && ov?.jobs != null && (
                <span className={`text-[0.68rem] px-1.5 py-0.2 rounded-full ${isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {ov.jobs}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / Update status + Live indicator + Locale + Theme */}
      <div className="mt-auto pt-4 border-t border-border space-y-3">
        {updateAvailable ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <div className="font-semibold text-foreground mb-1">
              <FormattedMessage
                id="app.update.available"
                defaultMessage="Mercury {version} available"
                values={{ version: updateStatus.data?.latest }}
              />
            </div>
            <div className="text-muted-foreground mb-2 text-[0.7rem]">
              <FormattedMessage
                id="app.update.current"
                defaultMessage="You have {version}"
                values={{ version: updateStatus.data?.current }}
              />
            </div>
            <Button
              size="xs"
              variant="outline"
              className="w-full text-xs"
              disabled={updating}
              onClick={handleStartUpdate}
            >
              <DownloadSimpleIcon className="size-3.5 mr-1" />
              {updating
                ? intl.formatMessage({ id: "app.update.updating", defaultMessage: "Updating..." })
                : intl.formatMessage({ id: "app.update.button", defaultMessage: "Update now" })}
            </Button>
            {updateOutput && (
              <pre className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap text-[0.65rem] font-mono text-muted-foreground bg-background/80 p-2 rounded border border-border">
                {updateOutput}
              </pre>
            )}
          </div>
        ) : updateStatus.status === "ready" ? (
          <div className="text-[0.7rem] text-muted-foreground px-1">
            Mercury {updateStatus.data?.current}
          </div>
        ) : null}

        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${
                connected ? "bg-emerald-500 shadow-xs shadow-emerald-500" : "bg-muted-foreground/40"
              }`}
            />
            <span className="text-[0.75rem]">
              {connected
                ? intl.formatMessage({ id: "app.status.live", defaultMessage: "live" })
                : intl.formatMessage({ id: "app.status.offline", defaultMessage: "offline" })}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <LocaleToggle />
            <ModeToggle />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 h-full">
        {sidebarContent}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Sticky Top Header */}
        <header className="flex items-center justify-between px-6 py-3 shrink-0 border-b border-border bg-background/80 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            {/* Mobile Sheet Trigger */}
            <div className="md:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger
                  render={
                    <Button variant="ghost" size="icon-xs">
                      <ListIcon className="size-5" />
                    </Button>
                  }
                />
                <SheetContent side="left" className="p-0 w-64">
                  {sidebarContent}
                </SheetContent>
              </Sheet>
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center text-xs font-medium text-muted-foreground">
              <span>
                <FormattedMessage id="app.workspace" defaultMessage="Workspace" />
              </span>
              <span className="mx-2 opacity-30">/</span>
              <span className="text-foreground font-semibold">{activeLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={`size-2 rounded-full ${
                  connected ? "bg-emerald-500 shadow-xs shadow-emerald-500" : "bg-muted-foreground/40"
                }`}
              />
              <span className="text-[0.75rem]">
                {connected
                  ? intl.formatMessage({ id: "app.status.live", defaultMessage: "live" })
                  : intl.formatMessage({ id: "app.status.offline", defaultMessage: "offline" })}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <LocaleToggle />
              <div className="md:hidden">
                <ModeToggle />
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Main Canvas */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-8">
          <div className="max-w-[1200px] mx-auto pb-16">
            {active === "overview" && <OverviewSection onnav={handleNavigate} />}
            {active === "profile" && <ProfileSection />}
            {active === "search" && <SearchSection />}
            {active === "launch" && <LaunchSection />}
            {active === "recruiters" && <RecruitersSection />}
            {active === "outreach" && <OutreachSection />}
            {active === "jobs" && <JobsSection />}
            {active === "applications" && <ApplicationsSection />}
            {active === "answers" && <AnswersSection />}
            {active === "interviews" && <InterviewsSection />}
            {active === "activity" && <ActivitySection />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;

