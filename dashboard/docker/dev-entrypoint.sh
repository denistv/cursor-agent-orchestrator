#!/bin/sh
set -eu

workspace_dir="/workspace/dashboard"
lockfile_path="$workspace_dir/package-lock.json"
modules_dir="$workspace_dir/node_modules"
stamp_path="$modules_dir/.package-lock.sha256"

cd "$workspace_dir"

if [ ! -f "$lockfile_path" ]; then
  echo "package-lock.json not found in $workspace_dir" >&2
  exit 1
fi

mkdir -p "$modules_dir"

current_hash="$(sha256sum "$lockfile_path" | awk '{print $1}')"
installed_hash=""

if [ -f "$stamp_path" ]; then
  installed_hash="$(cat "$stamp_path")"
fi

if [ ! -d "$modules_dir/.bin" ] || [ "$current_hash" != "$installed_hash" ]; then
  echo "Installing dashboard dependencies..."
  npm ci
  printf '%s\n' "$current_hash" > "$stamp_path"
fi

exec "$@"
