#!/usr/bin/env bash
# Mercury bootstrap installer — install or update in one command.
#
#   curl -fsSL https://raw.githubusercontent.com/Daniel-Boll/mercury/main/bootstrap.sh | bash
#
# Re-run the same command any time to update to the latest version.
#
# By default this downloads a prebuilt binary from the latest GitHub Release
# (fast — needs only curl). If no prebuilt binary matches your platform, or you
# set MERCURY_FROM_SOURCE=1, it falls back to building from source with Bun.
#
# Env overrides:
#   MERCURY_REPO         git remote (default: https://github.com/Daniel-Boll/mercury.git)
#   MERCURY_REPO_SLUG    owner/name for the API (default: Daniel-Boll/mercury)
#   MERCURY_REF          branch/tag/sha for source builds (default: main)
#   MERCURY_VERSION      release tag to install (default: latest, e.g. v0.2.0)
#   MERCURY_FROM_SOURCE  =1 to force building from source
#   MERCURY_SRC_DIR      where the repo is cached (default: ~/.mercury/src)
#   MERCURY_BIN_DIR      where the binary is linked (default: ~/.local/bin)
#   MERCURY_SKILLS_DIR   where skills are copied (default: auto-detected per tool)
#   MERCURY_NO_SKILLS=1  skip copying skills
set -euo pipefail

REPO="${MERCURY_REPO:-https://github.com/Daniel-Boll/mercury.git}"
REPO_SLUG="${MERCURY_REPO_SLUG:-Daniel-Boll/mercury}"
REF="${MERCURY_REF:-main}"
SRC_DIR="${MERCURY_SRC_DIR:-$HOME/.mercury/src}"
BIN_DIR="${MERCURY_BIN_DIR:-$HOME/.local/bin}"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
info() { printf '  \033[36m%s\033[0m\n' "$1"; }
warn() { printf '  \033[33m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
die()  { printf '\033[31merror:\033[0m %s\n' "$1" >&2; exit 1; }

bold "Mercury — installing/updating"

command -v curl >/dev/null 2>&1 || die "curl is required. Install curl and re-run."

# --- detect platform ---------------------------------------------------------
# Echoes the release asset name for this platform, or returns 1 if unsupported.
# Windows is detected when run under Git Bash / MSYS / Cygwin (uname -s gives
# MINGW*/MSYS*/CYGWIN*); the asset carries a .exe extension there.
detect_asset() {
  local os arch
  case "$(uname -s)" in
    Linux)              os="linux" ;;
    Darwin)             os="darwin" ;;
    MINGW*|MSYS*|CYGWIN*) os="windows" ;;
    *)                  return 1 ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64)  arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *)             return 1 ;;
  esac
  # Bun only ships windows-x64 (no windows-arm64).
  if [ "$os" = "windows" ]; then
    [ "$arch" = "x64" ] || return 1
    printf 'mercury-%s-%s.exe' "$os" "$arch"
    return 0
  fi
  printf 'mercury-%s-%s' "$os" "$arch"
}

# --- resolve the release tag to install --------------------------------------
resolve_tag() {
  if [ -n "${MERCURY_VERSION:-}" ]; then
    printf '%s' "$MERCURY_VERSION"
    return 0
  fi
  # Ask the API for the latest published release tag.
  curl -fsSL \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${REPO_SLUG}/releases/latest" 2>/dev/null \
    | grep -m1 '"tag_name"' \
    | sed -E 's/.*"tag_name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'
}

# --- copy skills (shared by both install paths) ------------------------------
# $1 = directory that contains a `skills/` subdir
copy_skills() {
  local skills_root="$1/skills"
  [ "${MERCURY_NO_SKILLS:-0}" = "1" ] && return 0
  [ -d "$skills_root" ] || { warn "No skills/ found to copy."; return 0; }

  local targets=()
  if [ -n "${MERCURY_SKILLS_DIR:-}" ]; then
    targets+=("$MERCURY_SKILLS_DIR")
  else
    [ -d "$HOME/.config/opencode" ] && targets+=("$HOME/.config/opencode/skills")
    [ -d "$HOME/.claude" ] && targets+=("$HOME/.claude/skills")
  fi
  if [ ${#targets[@]} -eq 0 ]; then
    warn "No agent skills dir detected — set MERCURY_SKILLS_DIR to copy skills."
    return 0
  fi
  local t
  for t in "${targets[@]}"; do
    mkdir -p "$t"
    cp -R "$skills_root/." "$t/"
    ok "Skills copied → $t"
  done
}

# --- source build fallback ---------------------------------------------------
install_from_source() {
  info "Installing from source (building with Bun)..."
  command -v git >/dev/null 2>&1 || die "git is required for a source build."

  if ! command -v bun >/dev/null 2>&1; then
    warn "Bun not found — installing it (https://bun.sh)..."
    curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1 \
      || die "Bun install failed. Install manually from https://bun.sh and re-run."
    export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
    export PATH="$BUN_INSTALL/bin:$PATH"
    command -v bun >/dev/null 2>&1 || die "Bun installed but not on PATH. Restart your shell and re-run."
    ok "Bun installed"
  else
    ok "Bun present ($(bun --version))"
  fi

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

  info "Building the mercury binary (this can take a minute)..."
  ( cd "$SRC_DIR/app" && bun install --silent && bun run build >/dev/null )
  [ -f "$SRC_DIR/app/dist/mercury" ] || die "Build did not produce dist/mercury"

  mkdir -p "$BIN_DIR"
  install -m 755 "$SRC_DIR/app/dist/mercury" "$BIN_DIR/mercury"
  ok "Installed mercury → $BIN_DIR/mercury (from source)"

  copy_skills "$SRC_DIR"
}

# --- prebuilt binary install -------------------------------------------------
install_prebuilt() {
  local asset tag binname
  asset="$(detect_asset)" || { warn "Unsupported platform for prebuilt binaries."; return 1; }

  # On Windows the installed binary keeps its .exe extension.
  case "$asset" in
    *.exe) binname="mercury.exe" ;;
    *)     binname="mercury" ;;
  esac

  tag="$(resolve_tag)"
  [ -n "$tag" ] || { warn "Could not resolve a release tag."; return 1; }
  info "Latest release: $tag ($asset)"

  local base="https://github.com/${REPO_SLUG}/releases/download/${tag}"
  local tmp; tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN

  info "Downloading ${asset}..."
  curl -fsSL "$base/$asset" -o "$tmp/$binname" || { warn "Binary download failed."; return 1; }

  # Verify checksum when SHA256SUMS is published and a hasher is available.
  if curl -fsSL "$base/SHA256SUMS" -o "$tmp/SHA256SUMS" 2>/dev/null; then
    local hasher=""
    command -v sha256sum >/dev/null 2>&1 && hasher="sha256sum"
    command -v shasum    >/dev/null 2>&1 && [ -z "$hasher" ] && hasher="shasum -a 256"
    if [ -n "$hasher" ]; then
      local want got
      want="$(grep " $asset\$" "$tmp/SHA256SUMS" | awk '{print $1}')"
      got="$($hasher "$tmp/$binname" | awk '{print $1}')"
      if [ -n "$want" ] && [ "$want" != "$got" ]; then
        die "Checksum mismatch for $asset (expected $want, got $got)."
      fi
      [ -n "$want" ] && ok "Checksum verified"
    fi
  fi

  mkdir -p "$BIN_DIR"
  install -m 755 "$tmp/$binname" "$BIN_DIR/$binname"
  ok "Installed mercury → $BIN_DIR/$binname (prebuilt $tag)"

  # Skills still ship in the repo; grab just the skills/ tree from the tag.
  if [ "${MERCURY_NO_SKILLS:-0}" != "1" ]; then
    info "Fetching skills for ${tag}..."
    if curl -fsSL "https://codeload.github.com/${REPO_SLUG}/tar.gz/refs/tags/${tag}" -o "$tmp/src.tgz" 2>/dev/null \
       && tar -xzf "$tmp/src.tgz" -C "$tmp" 2>/dev/null; then
      local extracted; extracted="$(find "$tmp" -maxdepth 1 -type d -name 'mercury-*' | head -1)"
      [ -n "$extracted" ] && copy_skills "$extracted"
    else
      warn "Could not fetch skills tarball; re-run with MERCURY_FROM_SOURCE=1 to copy skills."
    fi
  fi
  return 0
}

# --- orchestrate -------------------------------------------------------------
if [ "${MERCURY_FROM_SOURCE:-0}" = "1" ]; then
  install_from_source
elif ! install_prebuilt; then
  warn "Falling back to a source build..."
  install_from_source
fi

# --- PATH hint + first-run ---------------------------------------------------
echo
if ! command -v mercury >/dev/null 2>&1; then
  warn "Add $BIN_DIR to your PATH, then restart your shell:"
  printf '    export PATH="%s:$PATH"\n' "$BIN_DIR"
fi

VERSION="$("$BIN_DIR/mercury" --version 2>/dev/null || echo mercury)"
"$BIN_DIR/mercury" init >/dev/null || warn "Installed, but initialization failed — run: mercury init"
bold "Done — $VERSION"
echo "  Next:  mercury dashboard"
