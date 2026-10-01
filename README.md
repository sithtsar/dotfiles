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
Installation links Ghostty, Herdr, the sync commands, and the reusable agent
files described below. Existing configurations are backed up under
`~/.local/state/dotfiles/backups`. The other desktop configuration directories
in this repository are not installed by this script.

To get changes from GitHub on either machine:

```bash
dotfiles-sync
```

Reload Ghostty's configuration afterward and open a new shell if needed.
Updates are manual; there is no background sync process.
To publish edits made through the linked config files, commit and push from
the checkout, then run `dotfiles-sync` on the other machine. Keep changes
committed before syncing, since Git will refuse conflicting local edits.

## Claude Code, Codex, and Pi

`agents/` contains portable user preferences, instructions, hooks, output
styles, and 11 skills. Skills have one source in `agents/skills/`, linked into
`~/.agents/skills`, `~/.claude/skills`, and `~/.pi/agent/skills`.
Claude, Codex, and Pi must already be installed; Pi is
`@earendil-works/pi-coding-agent`, not the older package with a different scope.
Python 3.11 or newer, Git, and GitHub SSH access are required for full setup.

```bash
./install.sh
dotfiles-ai-setup
```

The second command installs the plugins recorded in `agents/sources.json`
through each agent's native plugin manager, installs Pi's npm/Git packages,
and checks out the private `sithtsar/pi-extensions` repo for the D2 renderer
and GitHub stack status extension. Work plugins are fetched directly from
`causalsecurity/armory`; their contents are not copied into this public repo.
The `github-personal` SSH alias must have access to your extension repository.
For Armory, setup uses the saved `causalsarthak` GitHub CLI OAuth login so that
a new SSH key awaiting organization SSO does not prevent setup. Credentials
are passed only to the child processes and are never saved in this repo.
Setup skips already installed Pi packages, reports incomplete steps, and can
be rerun. Downloading packages requires a working internet connection.

`dotfiles-sync` pulls changes and reapplies the shared settings and skills.
Run `dotfiles-ai-setup` again when package/plugin sources change. Start a new
agent session to load changed skills, hooks, and extensions.

JSON preferences are merged with each machine's existing settings, preserving
local values such as AWS configuration and Pi's device ID. Codex's shared model
and execution preferences are applied without replacing its local desktop
runtime, project trust, or plugin state. On a fresh machine, the Codex template
also adds Exa and DeepWiki; CMM, AWS MCP, and Strands stay disabled.
Existing private hooks are preserved locally; Armory supplies work hooks on
new machines. A missing CMM or fff executable causes the corresponding search
hook to stand down rather than starting a helper server.

Credentials, OAuth logins, histories, sessions, plugin caches, project trust,
and Mac desktop runtimes are not synchronized. Sign in to the agents on each
machine. Claude account-synced/cloud skills remain managed by Claude rather
than being republished here. Pi's microphone extension needs local audio tools;
the D2 renderer needs `d2`, and its scaled rendering also needs `chafa`.

Instruction, hook, and skill files are linked directly, so edits to them appear
in this checkout for review and commit. Agent-written JSON/TOML settings remain
local files; edit the templates under `agents/` to publish shared preferences.

Verify installation behavior without touching your home directory:

```bash
python3 agents/install.py --check
python3 agents/setup.py --check
./check-install.sh
```

Agent configuration references: [Codex skills](https://learn.chatgpt.com/docs/build-skills),
[Claude user settings](https://code.claude.com/docs/en/settings), and
[Pi settings](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/settings.md).
