#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
case "$(uname -s)" in
  Darwin) platform=macos ;;
  Linux) platform=linux ;;
  *) echo "Supported systems: macOS and Linux" >&2; exit 1 ;;
esac

config_dir=${XDG_CONFIG_HOME:-$HOME/.config}
backup_dir=${XDG_STATE_HOME:-$HOME/.local/state}/dotfiles/backups/$(date +%Y%m%d-%H%M%S)-$$

link_config() {
  local source=$1 target=$2
  if [[ -L "$target" && $(readlink "$target") == "$source" ]]; then
    return
  fi
  if [[ -e "$target" || -L "$target" ]]; then
    mkdir -p "$backup_dir"
    mv -- "$target" "$backup_dir/$(basename "$(dirname "$target")")-$(basename "$target")"
  fi
  mkdir -p -- "$(dirname -- "$target")"
  ln -s -- "$source" "$target"
}

link_config "$repo_dir/ghostty/$platform.conf" "$HOME/.config/ghostty/platform.conf"
link_config "$repo_dir/ghostty/config" "$config_dir/ghostty/config"
link_config "$repo_dir/herdr/config.toml" "$config_dir/herdr/config.toml"
link_config "$repo_dir/sync.sh" "$HOME/.local/bin/dotfiles-sync"
python3 "$repo_dir/agents/install.py"

echo "Linked Ghostty and Herdr from $repo_dir ($platform)."
echo "Any replaced files were preserved under $backup_dir."
