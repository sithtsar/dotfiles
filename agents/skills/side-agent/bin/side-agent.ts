#!/usr/bin/env bun
/**
 * side-agent — headless `pi -p` agents for adversarial review, verification,
 * and deep-research loops. Each invocation is a separate pi process with its
 * own isolated context window; the side agent can use pi's own skills/tools
 * (e.g. websearch for research loops) via normal skill discovery.
 *
 * Usage:
 *   bun side-agent.ts review [--base main] [files...]
 *       Adversarial review of the working diff (or named files).
 *   bun side-agent.ts verify "claim/checklist" [files...]
 *       Verify claims against the given files (or stdin).
 *   bun side-agent.ts research "topic"
 *       Deep research loop (websearch skill available to the agent).
 *
 * Common flags: --model provider/id   --json (machine-readable output)
 * Context is passed over stdin: `cat x | bun side-agent.ts verify "..."`.
 */
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";

const execFileP = promisify(execFile);
const MAX_CONTEXT_BYTES = 400_000; // keep the headless prompt sane

// ---------------------------------------------------------------------------

const REVIEW_PROMPT = `You are an adversarial code reviewer. Assume the diff is wrong until proven otherwise.

Review rules:
- Review ONLY the context below (git diff and/or files).
- Correctness first: bugs, invariant breaks, silent fallbacks papering over unclear invariants.
- Structure: is there a much simpler restructuration that preserves behavior? Flag avoidable orchestration complexity. No file past ~1k lines, no random spaghetti growth.
- Reuse: "this looks like a bespoke helper for something we already have elsewhere — can we reuse the canonical one?"
- Do not rubber-stamp "it works" implementations that leave the codebase messier.
- Do not soften major issues into mild suggestions. Do not flood with nits when larger structural issues exist.
- Be direct. No approval merely because behavior seems correct.

End with exactly three sections: VERDICT (merge / changes-requested), BLOCKING ISSUES (numbered), NITS (one line each).

Context (git diff + files):
`;

const VERIFY_PROMPT = `You are a verification agent. Do not rubber-stamp.

Below is a claim/checklist followed by context (files). For EACH claim output one row:
claim | VERIFIED | REFUTED | UNVERIFIABLE | evidence (file:line or exact quote)
- REFUTED wins if any evidence contradicts the claim.
- UNVERIFIABLE means the given context neither confirms nor contradicts — say exactly what evidence would be needed.
End with a summary line: X verified, Y refuted, Z unverifiable.

Claim/checklist:
`;

const RESEARCH_PROMPT = `You are a deep research agent working alone in a fresh session. Use the websearch skill (Exa) and any other pi tools available.

Answer the question with sourced evidence:
1. Gather multiple independent sources first.
2. Cross-check; note conflicts and how you resolved them.
3. Output: ANSWER (calibrated confidence), KEY EVIDENCE (source + quote), GAPS (what could not be verified).

Question:
`;

// ---------------------------------------------------------------------------

async function sh(cmd: string, args: string[]): Promise<string> {
	const { stdout } = await execFileP(cmd, args, { maxBuffer: MAX_CONTEXT_BYTES });
	return stdout;
}

async function collectReviewContext(base: string | undefined, files: string[]): Promise<string> {
	const parts: string[] = [];
	if (files.length === 0) {
		const baseArgs = base ? [base + "..."] : [];
		const diff = await sh("git", ["diff", ...baseArgs]).catch(() => "");
		if (diff.trim()) parts.push("=== git diff ===\n" + diff.slice(0, MAX_CONTEXT_BYTES));
		const staged = await sh("git", ["diff", "--cached"]).catch(() => "");
		if (staged.trim()) parts.push("=== git diff --cached ===\n" + staged.slice(0, MAX_CONTEXT_BYTES));
	} else {
		for (const f of files) {
			const content = await readFile(f, "utf8").catch(() => `(unreadable: ${f})`);
			parts.push(`=== ${f} ===\n` + content.slice(0, MAX_CONTEXT_BYTES / Math.max(1, files.length)));
		}
	}
	if (parts.length === 0) parts.push("(empty diff)");
	return parts.join("\n\n");
}

async function main() {
	const args = process.argv.slice(2);
	const mode = args[0];
	if (!["review", "verify", "research"].includes(mode ?? "")) {
		console.error(`usage: side-agent.ts <review|verify|research> [args] [--model <id>] [--json]`);
		process.exit(2);
	}

	const modelIdx = args.indexOf("--model");
	const model = modelIdx >= 0 ? args[modelIdx + 1] : undefined;
	const jsonMode = args.includes("--json");
	const rest = args.slice(1).filter((a, i) => {
		if (a === "--model") return false;
		if (args[i - 1] === "--model") return false;
		return a !== "--json";
	});

	let prompt: string;
	let stdin: string;

	if (mode === "review") {
		const baseIdx = rest.indexOf("--base");
		const base = baseIdx >= 0 ? rest[baseIdx + 1] : undefined;
		const clean: string[] = [];
		for (let i = 0; i < rest.length; i++) {
			if (rest[i] === "--base") {
				i++; // skip value
				continue;
			}
			clean.push(rest[i]);
		}
		prompt = REVIEW_PROMPT;
		stdin = await collectReviewContext(base, clean);
	} else if (mode === "verify") {
		const [text, ...files] = rest.filter((a) => !a.startsWith("--"));
		prompt = VERIFY_PROMPT + "\n" + (text || "(from stdin)") + "\n\nContext:\n";
		const ctx: string[] = [];
		for (const f of files) {
			const content = await readFile(f, "utf8").catch(() => `(unreadable: ${f})`);
			ctx.push(`=== ${f} ===\n` + content.slice(0, MAX_CONTEXT_BYTES));
		}
		stdin = ctx.join("\n\n") || "(no files — claims only)";
	} else {
		prompt = RESEARCH_PROMPT;
		stdin = rest.join(" ").replace(/^["']|["']$/g, "") || "(from stdin)";
	}

	const piArgs = ["-p", prompt];
	if (model) piArgs.push("--model", model);
	if (jsonMode) piArgs.push("--mode", "json");

	const child = spawn("pi", piArgs, { stdio: ["pipe", "inherit", "inherit"] });
	child.stdin.write(stdin);
	child.stdin.end();
	const code = await new Promise<number | null>((resolve) => child.on("close", resolve));
	process.exit(code ?? 1);
}

main().catch((e) => {
	console.error("✗ side-agent failed: " + (e as Error).message);
	process.exit(1);
});
