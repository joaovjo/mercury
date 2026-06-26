#!/usr/bin/env bun
import { parseFlags } from "./flags.ts";
import { initCmd } from "./init.ts";
import { setupCmd } from "./setup.ts";
import { recruiterCmd } from "./recruiter.ts";
import {
  jobCmd,
  metricCmd,
  scoreCmd,
  interviewCmd,
  applicationCmd,
  answerCmd,
  activityCmd,
} from "./records.ts";
import { importJourneyCmd } from "./import-journey.ts";
import { VERSION } from "../version.gen.ts";
import { checkForUpdate, maybePrintUpdateNotice } from "../update-check.ts";

const HELP = `mercury — AI-powered job search companion

Usage:
  mercury setup [--agent <id>] [--all] [--skills-dir <p>]  Install skills into your agent(s)
  mercury init                       Scaffold ~/.mercury/ + database
  mercury update [--force]          Update Mercury to the latest release
  mercury dashboard [--port N] [--no-open] [--provider opencode|claude-code]
  mercury import-journey <FILE.md>   Migrate a legacy JOURNEY.md into the db

Write API (used by skills):
  mercury recruiter add --name <n> [--company --username --title --location --degree --status --note]
  mercury recruiter update --id <n> [--status --note]
  mercury job save [--linkedin-id --title --company --location --work-type --comp --fit --link --status]
  mercury metric record [--search-appearances --profile-views --post-impressions --connections --score]
  mercury score record --value <n> [--signals <json>]
  mercury interview add --company <c> [--when --stage --status --note]
  mercury application add [--job-id --resume-path --cover-path --report-path --keyword-score --status --portal --external-url]
  mercury application update --id <n> [--status --portal --external-url --fields --unfilled]
  mercury answer set --key <k> [--value --category]   Set a reusable application answer
  mercury answer list [--category <c>]                List reusable application answers
  mercury export --typ <file> --out <file.pdf>        Compile a Typst doc to PDF
  mercury activity log [--kind --skill --summary --payload]

Options:
  -h, --help        Show this help
  -v, --version     Show version
`;

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const rest = argv.slice(1);

  if (!cmd || cmd === "-h" || cmd === "--help") {
    console.log(HELP);
    await maybePrintUpdateNotice();
    return;
  }
  if (cmd === "-v" || cmd === "--version") {
    console.log(`mercury ${VERSION}`);
    const notice = await checkForUpdate();
    if (notice) console.error("\n" + notice);
    return;
  }
  if (cmd === "update") {
    const { updateCmd } = await import("./update.ts");
    const { flags } = parseFlags(rest);
    await updateCmd(flags);
    return;
  }

  const { positionals, flags } = parseFlags(rest);

  // Kick off the update check concurrently with the command so the network
  // round-trip overlaps real work instead of adding latency on top of it.
  const updatePromise = checkForUpdate();

  switch (cmd) {
    case "init":
      initCmd();
      break;
    case "setup":
      await setupCmd(flags);
      break;
    case "dashboard": {
      const { dashboardCmd } = await import("../server/index.ts");
      // Long-running server; print any update notice up front, then hand off.
      const notice = await updatePromise;
      if (notice) console.error("\n" + notice + "\n");
      await dashboardCmd(flags);
      return;
    }
    case "import-journey": {
      const file = positionals[0];
      if (!file) {
        console.error("error: usage: mercury import-journey <FILE.md>");
        process.exit(1);
      }
      await importJourneyCmd(file);
      break;
    }
    case "recruiter":
      await recruiterCmd(positionals[0] ?? "", flags);
      break;
    case "job":
      await jobCmd(positionals[0] ?? "", flags);
      break;
    case "metric":
      await metricCmd(flags); // `record` subcommand is implicit
      break;
    case "score":
      await scoreCmd(flags);
      break;
    case "interview":
      await interviewCmd(positionals[0] ?? "", flags);
      break;
    case "application":
      await applicationCmd(positionals[0] ?? "", flags);
      break;
    case "answer":
      await answerCmd(positionals[0] ?? "", flags);
      break;
    case "export": {
      const { exportCmd } = await import("./export.ts");
      await exportCmd(flags);
      break;
    }
    case "activity":
      await activityCmd(flags);
      break;
    default:
      console.error(`unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exit(1);
  }

  // For short-lived commands, surface the update notice as a footer once the
  // real output is done. Bounded by the fetch timeout inside checkForUpdate().
  const notice = await updatePromise;
  if (notice) console.error("\n" + notice);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
