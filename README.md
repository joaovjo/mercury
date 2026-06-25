# LinkedIn Skills for OpenCode

AI agent skills that audit, optimize, and automate LinkedIn profile management, job scouting, and recruiter outreach — using browser automation (Playwright) and the [LinkedIn MCP Server](https://github.com/stickerdaniel/linkedin-mcp-server).

## What's Included

| Skill | What It Does |
|---|---|
| **linkedin-profile-optimizer** | Audits your profile against recruiter-search signals and fixes gaps via Playwright (Open to Work, headline, location, skills, languages, projects, About, experience) |
| **linkedin-job-scout** | Searches LinkedIn Jobs by company/location/work-type, pulls full details, and presents a prioritized shortlist with fit assessment |
| **linkedin-recruiter-outreach** | Finds technical recruiters at target companies, prioritizes by proximity/mutuals, and sends tailored connection requests |

See [`diagram.html`](diagram.html) for a visual of how the skills work together.

## Requirements

### MCP Servers

1. **[LinkedIn MCP Server](https://github.com/stickerdaniel/linkedin-mcp-server)** — Profile reading, job search, people search, connection requests
2. **Playwright MCP Server** — Browser automation for profile edits (LinkedIn doesn't expose these via API)

### Browser Setup

The Playwright MCP connects via Chrome DevTools Protocol. You must launch your browser with remote debugging enabled:

```bash
# Chrome
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/chrome-cdp-profile"

# Arc (macOS)
/Applications/Arc.app/Contents/MacOS/Arc --remote-debugging-port=9222 --user-data-dir="$HOME/arc-cdp-profile"

# Brave
brave --remote-debugging-port=9222 --user-data-dir="$HOME/brave-cdp-profile"
```

> **Important:** Quit any existing browser instance first — the port only binds on a fresh launch. You must be logged into LinkedIn in this browser session.

## Installation

Copy the `skills/` directory into your OpenCode config:

```bash
# Clone this repo
git clone https://github.com/<your-username>/linkedin-opencode-skills.git
cd linkedin-opencode-skills

# Copy skills to your OpenCode config
cp -r skills/* ~/.config/opencode/skills/
```

Or symlink if you prefer to keep them in sync:

```bash
for skill in skills/*/; do
  ln -sf "$(pwd)/$skill" ~/.config/opencode/skills/
done
```

The skills will appear in OpenCode's available skills list on next session.

## Usage

The agent loads these skills automatically when your request matches their description. Examples:

- *"Audit my LinkedIn profile and help me get more recruiter messages"* → loads `linkedin-profile-optimizer`
- *"Find backend engineer roles at DoorDash and Airbnb in São Paulo"* → loads `linkedin-job-scout`
- *"Find recruiters at Uber who hire in Brazil and connect with them"* → loads `linkedin-recruiter-outreach`

## What the Agent Can Actually Do

### Profile Optimizer
- Pull full profile analytics (search appearances, views, impressions)
- Identify specific pitfalls ranked by recruiter-search impact
- Edit via Playwright: Open to Work (recruiter-only), headline, location, top skills, languages, projects, About section, experience descriptions
- Remove internal-mobility cards that signal "not looking"

### Job Scout
- Search by company + location + work type + seniority
- Get full job descriptions with requirements and compensation
- Assess fit (Strong / Good / Stretch) based on your profile
- Flag diversity-scoped roles, staffing aggregators, and external ATS friction

### Recruiter Outreach
- Look up company URN IDs (required for LinkedIn's people search filter)
- Find technical recruiters/sourcers at target companies in your region
- Prioritize by: same city > 2nd-degree > mutual connections > relevant title
- Send connection requests with short, specific notes (<300 chars)
- Provide follow-up templates for post-acceptance

## Known Quirks & Limitations

- **Cannot auto-apply** to external ATS (Workday, Greenhouse) — these need personal data and auth answers
- **LinkedIn rate limits** — don't send >10-15 connection requests per session
- **Top Skills** are managed inside the About editor (`/add-edit/SUMMARY/`), not the Skills detail page
- **Company URN IDs** are required for people search filters — plain names are silently ignored
- **Typeahead fields** (language, skills) require ArrowDown + Enter after typing
- **"Notify network" toggle** — always verify it's OFF before saving experience edits

## Directory Structure

```
skills/
├── linkedin-job-scout/
│   └── SKILL.md
├── linkedin-profile-optimizer/
│   └── SKILL.md
└── linkedin-recruiter-outreach/
    └── SKILL.md
```

## License

The Unlicense — public domain. Do whatever you want with it.
