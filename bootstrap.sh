#!/usr/bin/env bash
# Mercury bootstrap installer — install or update in one command.
#
#   curl -fsSL https://raw.githubusercontent.com/Daniel-Boll/mercury/main/bootstrap.sh | bash
#
# Re-run the same command any time to update to the latest version.
#
# Env overrides:
#   MERCURY_REPO     git remote (default: https://github.com/Daniel-Boll/mercury.git)
#   MERCURY_REF      branch/tag/sha to install (default: main)
#   MERCURY_SRC_DIR  where the repo is cached (default: ~/.mercury/src)
#   MERCURY_BIN_DIR  where the binary is linked (default: ~/.local/bin)
#   MERCURY_SKILLS_DIR  where skills are copied (default: auto-detected per tool)
#   MERCURY_NO_SKILLS=1  skip copying skills
set -euo pipefail

REPO="${MERCURY_REPO:-https://github.com/Daniel-Boll/mercury.git}"
REF="${MERCURY_REF:-main}"
SRC_DIR="${MERCURY_SRC_DIR:-$HOME/.mercury/src}"
BIN_DIR="${MERCURY_BIN_DIR:-$HOME/.local/bin}"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
info() { printf '  \033[36m%s\033[0m\n' "$1"; }
warn() { printf '  \033[33m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
die()  { printf '\033[31merror:\033[0m %s\n' "$1" >&2; exit 1; }

bold "Mercury — installing/updating"

# --- prerequisites -----------------------------------------------------------
command -v git >/dev/null 2>&1 || die "git is required. Install git and re-run."

if ! command -v bun >/dev/null 2>&1; then
  warn "Bun not found — installing it (https://bun.sh)…"
  curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1 || die "Bun install failed. Install manually from https://bun.sh and re-run."
  # bun installs to ~/.bun/bin by default
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  command -v bun >/dev/null 2>&1 || die "Bun installed but not on PATH. Restart your shell and re-run."
  ok "Bun installed"
else
  ok "Bun present ($(bun --version))"
fi

# --- fetch or update the source ---------------------------------------------
if [ -d "$SRC_DIR/.git" ]; then
  info "Updating source in $SRC_DIR"
  git -C "$SRC_DIR" remote set-url origin "$REPO" 2>/dev/null || true
  git -C "$SRC_DIR" fetch --depth 1 origin "$REF" --quiet
  git -C "$SRC_DIR" checkout -q FETCH_HEAD
  ok "Source updated to latest $REF"
else
  info "Cloning $REPO → $SRC_DIR"
  mkdir -p "$(dirname "$SRC_DIR")"
  rm -rf "$SRC_DIR"
  git clone --depth 1 --branch "$REF" "$REPO" "$SRC_DIR" --quiet 2>/dev/null \
    || git clone --depth 1 "$REPO" "$SRC_DIR" --quiet
  ok "Source cloned"
fi

# --- build the binary --------------------------------------------------------
info "Building the mercury binary (this can take a minute)…"
cd "$SRC_DIR/app"
bun install --silent
bun run build >/dev/null
[ -f "$SRC_DIR/app/dist/mercury" ] || die "Build did not produce dist/mercury"

mkdir -p "$BIN_DIR"
install -m 755 "$SRC_DIR/app/dist/mercury" "$BIN_DIR/mercury"
ok "Installed mercury → $BIN_DIR/mercury"

# --- copy skills -------------------------------------------------------------
if [ "${MERCURY_NO_SKILLS:-0}" != "1" ]; then
  # Auto-detect known skill dirs; user can override with MERCURY_SKILLS_DIR.
  SKILL_TARGETS=()
  if [ -n "${MERCURY_SKILLS_DIR:-}" ]; then
    SKILL_TARGETS+=("$MERCURY_SKILLS_DIR")
  else
    [ -d "$HOME/.config/opencode" ] && SKILL_TARGETS+=("$HOME/.config/opencode/skills")
    [ -d "$HOME/.claude" ] && SKILL_TARGETS+=("$HOME/.claude/skills")
  fi
  if [ ${#SKILL_TARGETS[@]} -eq 0 ]; then
    warn "No agent skills dir detected — set MERCURY_SKILLS_DIR to copy skills."
  else
    for t in "${SKILL_TARGETS[@]}"; do
      mkdir -p "$t"
      cp -R "$SRC_DIR/skills/." "$t/"
      ok "Skills copied → $t"
    done
  fi
fi

# --- PATH hint + first-run ----------------------------------------------------
echo
if ! command -v mercury >/dev/null 2>&1; then
  warn "Add $BIN_DIR to your PATH, then restart your shell:"
  printf '    export PATH="%s:$PATH"\n' "$BIN_DIR"
fi

VERSION="$("$BIN_DIR/mercury" --version 2>/dev/null || echo mercury)"
bold "Done — $VERSION"
echo "  Next:  mercury init && mercury dashboard"
