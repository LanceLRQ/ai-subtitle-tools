#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/bump-version.sh <version>
# Example: ./scripts/bump-version.sh 0.2.0
# Updates version in package.json, Cargo.toml, and tauri.conf.json

if [ $# -ne 1 ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.2.0"
  exit 1
fi

VERSION="$1"

# Validate semver format
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
  echo "Error: Invalid version format. Expected semver (e.g., 0.2.0 or 1.0.0-beta.1)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
APP_DIR="$PROJECT_ROOT/app"

echo "Bumping version to $VERSION ..."

# 1. package.json
PACKAGE_JSON="$APP_DIR/package.json"
if [ -f "$PACKAGE_JSON" ]; then
  sed -i.bak -E "s/\"version\": \"[^\"]+\"/\"version\": \"$VERSION\"/" "$PACKAGE_JSON"
  rm -f "$PACKAGE_JSON.bak"
  echo "  Updated $PACKAGE_JSON"
else
  echo "  Warning: $PACKAGE_JSON not found"
fi

# 2. Cargo.toml
CARGO_TOML="$APP_DIR/src-tauri/Cargo.toml"
if [ -f "$CARGO_TOML" ]; then
  # Only replace the version in [package] section (first occurrence)
  sed -i.bak -E '0,/^version = "[^"]+"/s/^version = "[^"]+"/version = "'"$VERSION"'"/' "$CARGO_TOML"
  rm -f "$CARGO_TOML.bak"
  echo "  Updated $CARGO_TOML"
else
  echo "  Warning: $CARGO_TOML not found"
fi

# 3. tauri.conf.json
TAURI_CONF="$APP_DIR/src-tauri/tauri.conf.json"
if [ -f "$TAURI_CONF" ]; then
  sed -i.bak -E "s/\"version\": \"[^\"]+\"/\"version\": \"$VERSION\"/" "$TAURI_CONF"
  rm -f "$TAURI_CONF.bak"
  echo "  Updated $TAURI_CONF"
else
  echo "  Warning: $TAURI_CONF not found"
fi

echo "Done! Version bumped to $VERSION"
echo ""
echo "Next steps:"
echo "  git add -A && git commit -m 'chore: bump version to $VERSION'"
echo "  git tag v$VERSION"
echo "  git push && git push --tags"
