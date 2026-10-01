# dotfiles
my own arch ~/.config files (may or may not work)

## Shared Ghostty and Herdr configuration

`main` is the shared source for Plato (macOS) and Cronos (Omarchy/Linux).
Both use the same Ghostty theme, font size, padding, split shortcuts, and
Herdr configuration. Only native platform settings live in separate files.
Herdr uses Ctrl+B as its prefix on both machines, followed by `|` for a
vertical split. Its status bar names the Herdr server; its window title
also shows the active pane's terminal title, including SSH host names.

```bash
git clone git@github-personal:sithtsar/dotfiles.git ~/personal/dotfiles
cd ~/personal/dotfiles
./install.sh
```

The `github-personal` SSH alias must authenticate as `sithtsar`.
Alternatively, use `https://github.com/sithtsar/dotfiles.git` to clone.
Installation only links Ghostty, Herdr, and the sync command. Existing
configurations are backed up under `~/.local/state/dotfiles/backups`.
The other directories in this repository are not installed by this script.

To get changes from GitHub on either machine:

```bash
dotfiles-sync
```

Reload Ghostty's configuration afterward and open a new shell if needed.
Updates are manual; there is no background sync process.
To publish edits made through the linked config files, commit and push from
the checkout, then run `dotfiles-sync` on the other machine. Keep changes
committed before syncing, since Git will refuse conflicting local edits.
