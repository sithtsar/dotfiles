#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
test_home=$(mktemp -d)
trap 'rm -rf -- "$test_home"' EXIT
export HOME=$test_home
export XDG_CONFIG_HOME=$HOME/.config
export XDG_STATE_HOME=$HOME/.local/state
mkdir -p "$HOME/.config/ghostty" "$HOME/.config/herdr"
printf 'original ghostty\n' > "$HOME/.config/ghostty/config"
printf 'original herdr\n' > "$HOME/.config/herdr/config.toml"

"$repo_dir/install.sh"
[[ $(readlink "$HOME/.config/ghostty/config") == "$repo_dir/ghostty/config" ]]
[[ $(readlink "$HOME/.config/herdr/config.toml") == "$repo_dir/herdr/config.toml" ]]
[[ -f "$HOME/.config/ghostty/platform.conf" ]]
[[ -x "$HOME/.local/bin/dotfiles-sync" ]]
backups=("$HOME"/.local/state/dotfiles/backups/*)
[[ ${#backups[@]} == 1 ]]
[[ $(cat "${backups[0]}/ghostty-config") == 'original ghostty' ]]
[[ $(cat "${backups[0]}/herdr-config.toml") == 'original herdr' ]]

"$repo_dir/install.sh"
after=("$HOME"/.local/state/dotfiles/backups/*)
[[ ${#after[@]} == 1 ]]
echo 'PASS: config links, preserved originals, and idempotent reinstall.'
