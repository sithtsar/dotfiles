#!/usr/bin/env bash
set -euo pipefail

# Resolve the installed dotfiles-sync symlink before locating the checkout.
script_path=${BASH_SOURCE[0]}
while [[ -L "$script_path" ]]; do
  link_dir=$(cd -- "$(dirname -- "$script_path")" && pwd)
  script_path=$(readlink "$script_path")
  [[ "$script_path" == /* ]] || script_path="$link_dir/$script_path"
done
repo_dir=$(cd -- "$(dirname -- "$script_path")" && pwd)
git -C "$repo_dir" pull --ff-only
"$repo_dir/install.sh"
if command -v herdr >/dev/null 2>&1; then
  herdr server reload-config || echo "Herdr can load the config when next started."
fi
