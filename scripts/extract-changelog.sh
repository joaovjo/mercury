#!/usr/bin/env bash
# Extract the changelog section for a given version from CHANGELOG.md.
#
# Usage: scripts/extract-changelog.sh <version> [changelog-path]
#   <version> may be "0.3.1" or "v0.3.1" (the leading v is stripped).
#
# Prints the body of the matching "## [<version>] - ..." section (without the
# heading line) to stdout. Exits non-zero if the section is not found.
set -euo pipefail

raw_version="${1:?usage: extract-changelog.sh <version> [changelog-path]}"
changelog="${2:-CHANGELOG.md}"
version="${raw_version#v}"

if [[ ! -f "$changelog" ]]; then
  echo "extract-changelog: $changelog not found" >&2
  exit 1
fi

# awk: start printing after the heading for our version, stop at the next
# "## [" heading. Match "## [<version>]" exactly (anchored on the bracket).
body="$(
  awk -v ver="$version" '
    BEGIN { found = 0 }
    /^## \[/ {
      if (found) { exit }
      # Extract the token between the first [ and ].
      line = $0
      sub(/^## \[/, "", line)
      sub(/\].*/, "", line)
      if (line == ver) { found = 1; next }
    }
    found { print }
  ' "$changelog"
)"

# Trim leading/trailing blank lines (portable: no tac).
body="$(
  printf '%s\n' "$body" | awk '
    { lines[NR] = $0 }
    END {
      start = 1; end = NR
      while (start <= end && lines[start] ~ /^[[:space:]]*$/) start++
      while (end >= start && lines[end] ~ /^[[:space:]]*$/) end--
      for (i = start; i <= end; i++) print lines[i]
    }
  '
)"

if [[ -z "$body" ]]; then
  echo "extract-changelog: no section found for version $version in $changelog" >&2
  exit 2
fi

printf '%s\n' "$body"
