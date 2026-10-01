/**
 * prefer-fff — route filesystem search to the fff index instead of shelling out.
 *
 * Why: fff (`ffgrep` / `fffind` / `fff-multi-grep`, from @ff-labs/pi-fff) searches
 * a live index and is frecency-ranked and git-aware. `grep -r` walks the tree.
 * On this machine the agent had been reaching for bash grep/find by reflex, which
 * is slower and ignores the index entirely.
 *
 * This BLOCKS rather than warns. A reminder appended to a tool result gets read
 * after the expensive work is already done; a block costs one retry and changes
 * the next call. The reason string names the replacement, so the retry is
 * immediate and needs no judgement from the model.
 *
 * Deliberately narrow — it must not break things that only look like search:
 *   - `… | grep foo`  is STREAM filtering, not filesystem search. fff cannot do
 *     it, so it is allowed.
 *   - `git log --grep=` is not a search tool at all. Allowed.
 *   - `find` with no `-name`/`-type`/`-iname` may be a build step. Allowed.
 * Disable with: FFF_PREFER_HOOK=0, or `"preferFff": false` in ~/.pi/agent/settings.json.
 */

const STREAM_FILTER = /\|\s*(grep|rg|ag|ack)\b/;          // `… | grep x` — allow
const NOT_A_SEARCH = /--grep=|git\s+grep\s+--|grep\s+-[qvc]\b/;

const RULES: { re: RegExp; tool: string; why: string }[] = [
  { re: /(^|[;&|]\s*)(rg|ag|ack)\s/,                     tool: "ffgrep", why: "ripgrep-style content search" },
  { re: /\bgrep\b[^|]*\s(-{1,2}[a-zA-Z]*r[a-zA-Z]*|--recursive)\b/, tool: "ffgrep", why: "recursive content search" },
  { re: /(^|[;&|]\s*)grep\s+(-[a-zA-Z]+\s+)*[^|]*\S/, tool: "ffgrep", why: "content search" },
  { re: /\bgit\s+grep\b/,                                tool: "ffgrep", why: "content search" },
  { re: /(^|[;&|]\s*)fd\s/,                              tool: "fffind", why: "filename search" },
  { re: /\bfind\s+[^|]*\s(-name|-iname|-type|-path)\b/,  tool: "fffind", why: "filename search" },
  { re: /\bls\s+-[a-zA-Z]*R[a-zA-Z]*/,                   tool: "fffind", why: "recursive listing" },
];

export default function (pi: any) {
  if (process.env.FFF_PREFER_HOOK === "0") return;

  pi.on("tool_call", async (event: any, ctx: any) => {
    // Built-in grep/find are the exact tools fff replaces — always redirect.
    if (event.toolName === "grep") {
      return { block: true, reason:
        "Use the ffgrep tool instead of the built-in grep. It searches the live fff " +
        "index (frecency-ranked, git-aware) rather than walking the tree. " +
        "Args: {pattern, path?, exclude?, context?, limit?, cursor?}." };
    }
    if (event.toolName === "find") {
      return { block: true, reason:
        "Use the fffind tool instead of the built-in find. It searches the live fff " +
        "index. Args: {pattern, path?, exclude?, limit?, cursor?}. " +
        "Multi-word patterns narrow (AND); use path:'**/name' for exact matches." };
    }

    if (event.toolName !== "bash") return;
    const cmd: string = event.input?.command ?? "";
    if (!cmd || cmd.length > 4000) return;
    // A multi-line script (heredoc, python -c, JSON payload) is far more likely to
    // CONTAIN the word grep than to be running it. This hook blocked a command whose
    // only sin was the literal text `"grep":"deny"` inside a JSON heredoc -- the
    // token cannot tell a command from a string. Only single-line commands are
    // judged, unless the script OPENS with a search command.
    if (cmd.includes("\n") && !/^\s*(rg|ag|ack|grep|fd|find|ls)\b/.test(cmd)) return;
    if (STREAM_FILTER.test(cmd) || NOT_A_SEARCH.test(cmd)) return;

    for (const r of RULES) {
      if (r.re.test(cmd)) {
        return { block: true, reason:
          `Use the ${r.tool} tool for ${r.why} instead of shelling out. ` +
          `${r.tool} searches the live fff index (frecency-ranked, git-aware) and is ` +
          `faster than walking the tree. Shell ${r.why} is only appropriate for ` +
          `piping a command's output, e.g. \`some-cmd | grep x\` — which is allowed.` };
      }
    }
  });

  pi.on("session_start", async (_e: any, ctx: any) => {
    if (ctx?.ui?.setStatus) ctx.ui.setStatus("prefer-fff", undefined);
  });
}
