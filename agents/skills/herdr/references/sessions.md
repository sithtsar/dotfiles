# Sessions on plato and cronos

Use these recipes when helping the human reconnect, choose a session, or understand persistence. For pane or agent control, follow the parent skill's `HERDR_ENV=1` guard and discover IDs on the selected server.

## Choose the right target

- `plato` is the Mac; `cronos` is the Linux machine. Both are SSH aliases already configured on the other machine.
- A Herdr session is an independent server namespace. A workspace groups project tabs and panes within a session. Agent conversation IDs belong to Claude, Codex, or Pi; they are different from Herdr session names and pane IDs.
- Inspect local saved profiles with `herdr machine list --json`. Saved labels are case-sensitive. Remote API commands use the saved profile's configured session; an SSH alias alone is not a machine selector.
- On cronos, use `~/.local/bin/herdr` if a noninteractive SSH shell finds the older system binary. Check `herdr --version` and `herdr status`; the running server can have a different compatible version.

## Attach and detach in the human's terminal

Run these from an ordinary terminal outside Herdr:

```bash
# Reattach locally; an existing default session keeps its running panes.
herdr

# List local sessions, then attach by the exact name.
herdr session list --json
herdr session attach work

# From plato, open cronos's default session through SSH.
herdr --remote cronos

# From plato, attach to a named session on cronos.
herdr --remote cronos --session work

# From cronos, open plato's default session.
herdr --remote plato
```

Named-session attachment can create a new session when it does not exist. Reuse the name returned by `session list` when the goal is reconnecting. To discover cronos's session names from plato, use `ssh cronos '~/.local/bin/herdr session list --json'`; use `ssh plato 'herdr session list --json'` in the other direction. These list commands read session metadata, not pane output.

Detach with **Ctrl+B, release, Q**. Closing the client or losing SSH also leaves remote processes running while the host remains awake. Detaching does not stop the server. Sleep, shutdown, and server termination do not guarantee processes continue.

For an SSH-only terminal workflow, connect with `ssh cronos` or `ssh plato`, then run `herdr` in the remote shell. For a local rendered UI with desktop clipboard support, use `herdr --remote` instead.

To attach directly to one agent, discover its live name and use `herdr agent attach <name>` in the human's terminal on that server. Direct attach also detaches with Ctrl+B then Q. Do not use `--takeover` unless replacing the current input owner is intended. Do not combine interactive attachment with `--machine`.

## Control the intended machine from an agent pane

Check `HERDR_ENV=1` first. Preserve the same machine selector for every read and mutation:

```bash
herdr machine list --json
herdr --machine cronos agent list
herdr --machine cronos pane list
```

On cronos, substitute its saved `plato` profile when targeting the Mac. Use the returned remote agent names and pane IDs; local IDs and `--current` do not target remote panes. Do not combine `--machine` with `--session` or `--remote`. Machine forwarding requires an already-running compatible remote server; inspect connection failures before retrying mutations.

## Restore conversations after a restart

Detaching preserves the actual running agent. A full server restart restores layout and directories, but not arbitrary running processes. A reusable skill alone does not enable native conversation restore.

Check `herdr integration status`. When the user requests native restore or agent integration setup, use the official installers on each machine:

```bash
herdr integration install claude
herdr integration install codex
herdr integration install pi
```

These install local hooks/extensions; restart the affected agent sessions so they load. They report conversation references while agents run inside Herdr. Native restore requires a supported conversation reference and `[session] resume_agents_on_restore` enabled (the documented default). Claude and Codex lifecycle state still comes from screen detection; Pi's integration also reports lifecycle state. Never promise that an unreported or unsupported conversation will resume.

Treat `herdr server stop`, `herdr session stop`, and `herdr session delete` as destructive session actions, not disconnect commands. Do not stop or upgrade a live server merely to make a newer CLI feature work. Keep session files, snapshots, screen history, and agent conversations outside dotfiles.

## Sources and maintenance

The parent skill is adapted from the official [v0.9.3 skill](https://github.com/herdrdev/herdr/blob/v0.9.3/skills/herdr/SKILL.md), verified against the installed `herdr --skill`. Its Apache-2.0 license is included in `../LICENSE`. The added routing paragraph and this local guide are dotfiles additions.

Verify syntax with the installed command group's `--help` before use after an upgrade. Refresh the upstream skill deliberately from the matching release; retain this guide and the control/authorization boundaries.

Primary references: [agent skill](https://github.com/herdrdev/herdr/blob/v0.9.3/docs/next/website/src/content/docs/agent-skill.mdx), [persistence and remote access](https://github.com/herdrdev/herdr/blob/v0.9.3/docs/next/website/src/content/docs/persistence-remote.mdx), [session restore](https://github.com/herdrdev/herdr/blob/v0.9.3/docs/next/website/src/content/docs/session-state.mdx), and [integrations](https://github.com/herdrdev/herdr/blob/v0.9.3/docs/next/website/src/content/docs/integrations.mdx).
