#!/usr/bin/env bun
/**
 * mcp-web — Exa web search + DeepWiki repository docs, over MCP streamable HTTP.
 *
 * No SDK, no auth required for public use. The wire protocol is POST + SSE:
 * initialize -> notifications/initialized -> tools/call, with the Mcp-Session-Id
 * header echoed from the initialize response. Both servers accept keyless calls;
 * if a call comes back unauthed (Exa key needed / private mode), the script
 * falls back to the agent-browser auth flow (see runExaAuth).
 *
 * Usage:
 *   bun mcp-web.ts search "query" [numResults] [--text]
 *   bun mcp-web.ts fetch "https://..."
 *   bun mcp-web.ts wiki "owner/repo"
 *   bun mcp-web.ts wiki-read "owner/repo" "topic"
 *   bun mcp-web.ts ask "owner/repo" "question"
 *   bun mcp-web.ts auth                # force Exa auth via agent-browser
 *   bun mcp-web.ts status              # key / config state
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, basename } from "node:path";

const execFileP = promisify(execFile);
const AB = join(homedir(), ".bun", "bin", "agent-browser");
const CONFIG_DIR = join(homedir(), ".pi", "agent");
const CONFIG_FILE = join(CONFIG_DIR, "exa.json");

const EXA_MCP = "https://mcp.exa.ai/mcp";
const DEEPWIKI_MCP = "https://mcp.deepwiki.com/mcp";
const EXA_DASHBOARD = "https://dashboard.exa.ai/api-keys";
const LOGIN_TIMEOUT_MS = 5 * 60_000;
const POLL_MS = 2_000;

const EXA_KEY_RE = /exa_[A-Za-z0-9_-]{16,}/;
const HEX_KEY_RE = /\b[0-9a-fA-F]{32,}\b/;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// MCP client (minimal, streamable HTTP)
// ---------------------------------------------------------------------------

interface McpResult {
  content?: { type: string; text?: string }[];
  isError?: boolean;
  [k: string]: unknown;
}

async function mcpCall(
  serverUrl: string,
  tool: string,
  args: Record<string, unknown>,
  headers: Record<string, string> = {},
  timeoutMs = 60_000,
): Promise<McpResult> {
  const initRes = await fetch(serverUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "mcp-web", version: "1.0.0" },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (initRes.status === 401) return { isError: true, content: [{ type: "text", text: "HTTP 401 unauthorized" }] };
  const sessionId = initRes.headers.get("mcp-session-id") ?? "";
  await initRes.text(); // drain; initialize result is not needed

  const callHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...headers,
  };
  if (sessionId) callHeaders["Mcp-Session-Id"] = sessionId;

  const callRes = await fetch(serverUrl, {
    method: "POST",
    headers: callHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const body = await callRes.text();
  for (const chunk of body.split("\n\n")) {
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const msg = JSON.parse(line.slice(5).trim()) as {
        result?: McpResult;
        error?: { code?: number; message?: string };
      };
      if (msg.error) return { isError: true, content: [{ type: "text", text: `MCP error ${msg.error.code}: ${msg.error.message}` }] };
      if (msg.result) return msg.result;
    }
  }
  return { isError: true, content: [{ type: "text", text: "empty MCP response" }] };
}

// ---------------------------------------------------------------------------
// Key storage
// ---------------------------------------------------------------------------

async function storedExaKey(): Promise<string | null> {
  if (process.env.EXA_API_KEY) return process.env.EXA_API_KEY;
  try {
    const cfg = JSON.parse(await readFile(CONFIG_FILE, "utf8")) as { apiKey?: string };
    return cfg.apiKey?.trim() || null;
  } catch {
    return null;
  }
}

async function saveExaKey(key: string) {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify({ apiKey: key }, null, 2) + "\n", { mode: 0o600 });
}

function exaHeaders(key: string | null): Record<string, string> {
  return key ? { "x-api-key": key } : {};
}

function deepwikiHeaders(): Record<string, string> {
  return process.env.DEEPWIKI_MCP_API_KEY
    ? { Authorization: `Bearer ${process.env.DEEPWIKI_MCP_API_KEY}` }
    : {};
}

// ---------------------------------------------------------------------------
// agent-browser automation (auto-auth)
// ---------------------------------------------------------------------------

async function ab(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileP(AB, args, { timeout: 30_000 });
    return stdout.trim();
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string; message?: string };
    if (err.message?.includes("ENOENT")) {
      console.error("agent-browser not found at " + AB);
      process.exit(1);
    }
    throw new Error(`agent-browser ${args[0]} failed: ${err.stderr || err.stdout || err.message}`);
  }
}

function looksUnauthed(result: McpResult): boolean {
  // Only treat ERROR results as auth signals — result content can legitimately
  // mention "api key"/"quota"/"not authorized" and must not trip the flow.
  if (!result.isError) return false;
  const text = (result.content ?? [])
    .map((c) => c.text ?? "")
    .join("\n")
    .toLowerCase();
  return /(401|unauthor|api key|not authorized|private mode|rate limit|quota)/.test(text);
}

async function runExaAuth(): Promise<string | null> {
  console.log("→ Opening " + EXA_DASHBOARD + " in agent-browser…");
  await ab(["open", EXA_DASHBOARD]);
  let url = await ab(["get", "url"]);

  if (!url.startsWith("https://dashboard.exa.ai")) {
    console.log("→ Exa is not logged in. Complete login in the browser window (Google or email).");
    console.log(`→ Waiting up to ${LOGIN_TIMEOUT_MS / 60_000} minutes…`);
    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_MS);
      url = await ab(["get", "url"]);
      if (url.startsWith("https://dashboard.exa.ai")) break;
    }
  }

  if (!url.startsWith("https://dashboard.exa.ai")) {
    console.error("✗ Login did not complete in time. Run again once logged in, or paste your key into " + CONFIG_FILE + ' as {"apiKey": "..."}.');
    return null;
  }
  console.log("→ Logged in. Extracting API key…");

  const key = await extractExaKey();
  if (!key) {
    console.error("✗ Could not extract the key automatically. Open " + EXA_DASHBOARD + ", copy your key, and paste it into " + CONFIG_FILE + ' as {"apiKey": "..."}.');
    return null;
  }
  await saveExaKey(key);
  console.log("✓ Saved Exa API key to " + CONFIG_FILE + " (mode 0600)");
  return key;
}

async function extractExaKey(): Promise<string | null> {
  const scan = async (): Promise<string | null> => {
    const text = await ab(["eval", "document.body.innerText"]).catch(() => "");
    return text.match(EXA_KEY_RE)?.[0] ?? text.match(HEX_KEY_RE)?.[0] ?? null;
  };

  let key = await scan();
  if (key) return key;

  // Fresh keys are shown once in full — create one if the page offers it.
  await ab(["find", "text", "Create API key", "click"]).catch(() => {});
  await sleep(1500);
  key = await scan();
  if (key) return key;

  // Fall back to a Copy button + clipboard read.
  await ab(["find", "text", "Copy", "click"]).catch(() => {});
  await sleep(600);
  const clip = await ab(["clipboard", "read"]).catch(() => "");
  return clip.match(EXA_KEY_RE)?.[0] ?? clip.match(HEX_KEY_RE)?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdSearch(query: string, numResults: number, withText: boolean): Promise<void> {
  let key = await storedExaKey();
  let result = await mcpCall(
    EXA_MCP,
    "web_search_exa",
    { query, numResults, contents: withText ? { text: { maxCharacters: 800 } } : undefined },
    exaHeaders(key),
  );

  // Auto-auth: unauthed + no key -> browser flow -> retry once.
  if (looksUnauthed(result) && !key) {
    console.log("→ Search requires an Exa key — running auto-auth via agent-browser.");
    key = await runExaAuth();
    if (key) result = await mcpCall(EXA_MCP, "web_search_exa", { query, numResults }, exaHeaders(key));
  }

  const text = (result.content ?? []).map((c) => c.text ?? "").join("\n").trim();
  if (!text) {
    console.error("✗ No results returned" + (result.isError ? " (server error)" : "") + ". Set EXA_API_KEY or run: bun mcp-web.ts auth");
    process.exit(1);
  }
  console.log(text.slice(0, 12_000));
}

async function jinaRead(url: string): Promise<string> {
  const res = await fetch("https://r.jina.ai/" + url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Jina Reader HTTP ${res.status}`);
  return (await res.text()).trim();
}

async function cmdFetch(url: string): Promise<void> {
  let text = "";
  try {
    const result = await mcpCall(EXA_MCP, "web_fetch_exa", { urls: [url], maxCharacters: 15_000 }, exaHeaders(await storedExaKey()));
    text = (result.content ?? []).map((c) => c.text ?? "").join("\n").trim();
  } catch {
    // fall through to Jina
  }
  if (!text) {
    console.error("→ Exa fetch empty/blocked; falling back to Jina Reader.");
    try {
      text = await jinaRead(url);
    } catch (e) {
      console.error("✗ Fetch failed (Exa + Jina): " + (e as Error).message);
      process.exit(1);
    }
  }
  console.log(text.slice(0, 20_000));
}

// Document parsing via firecrawl anydoc (local, keyless, MIT).
// Text-based docs convert locally; scanned/image-only PDFs would need Firecrawl Parse (API key) — not supported here.
async function cmdDoc(target: string): Promise<void> {
  let path = target;
  let downloaded: string | null = null;
  if (/^https?:\/\//.test(target)) {
    const dir = join(tmpdir(), "mcp-web-docs");
    await mkdir(dir, { recursive: true });
    let name = basename(new URL(target).pathname) || "document";
    if (!/\.[a-z0-9]{2,5}$/i.test(name)) name += ".bin"; // anydoc sniffs bytes anyway
    path = join(dir, `${Date.now()}-${name}`);
    const res = await fetch(target, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
    await writeFile(path, Buffer.from(await res.arrayBuffer()));
    downloaded = path;
  }
  try {
    const { stdout } = await execFileP("bun", ["x", "@firecrawl/anydoc", path], { timeout: 180_000, maxBuffer: 64 * 1024 * 1024 });
    console.log(stdout.slice(0, 60_000));
  } finally {
    if (downloaded) await unlink(downloaded).catch(() => {});
  }
}

// YouTube/local video transcript via yt-dlp (keyless). Visual frame analysis needs Gemini keys — not supported here.
async function cmdYt(url: string): Promise<void> {
  const dir = join(tmpdir(), `mcp-web-yt-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  const outBase = join(dir, "subs");
  try {
    await execFileP("yt-dlp", [
      "--skip-download", "--write-auto-subs", "--write-subs",
      "--sub-langs", "en.*,en", "--convert-subs", "vtt",
      "-o", outBase, url,
    ], { timeout: 180_000 });
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    throw new Error("yt-dlp failed: " + (err.stderr?.split("\n").filter(Boolean).slice(-2).join(" | ") || err.message));
  }
  const file = (await readdir(dir)).find((f) => f.endsWith(".vtt"));
  if (!file) throw new Error("no subtitles available for this video");
  const raw = await readFile(join(dir, file), "utf8");
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const line of raw.split("\n")) {
    const t = line
      .replace(/<[^>]+>/g, "")                       // vtt tags
      .replace(/^\d{2}:\d{2}:\d{2}\.\d{3}.*$/m, "") // cue timings
      .trim();
    if (!t || /^(WEBVTT|Kind:|Language:|NOTE)/.test(t) || seen.has(t)) continue;
    seen.add(t);
    lines.push(t);
  }
  console.log(lines.join(" ").slice(0, 40_000));
}

// GitHub repo as local checkout (shallow clone to /tmp), like pi-web-access's github handler.
async function cmdGh(spec: string): Promise<void> {
  const [repo, ref] = spec.split("@");
  if (!/^([\w.-]+)\/([\w.-]+)$/.test(repo)) throw new Error('usage: mcp-web.ts gh "owner/repo[@ref]"');
  const dest = join(tmpdir(), repo.replace("/", "-") + (ref ? `-${ref.replace(/[^\w.-]/g, "")}` : ""));
  const args = ["clone", "--depth", "1"];
  if (ref) args.push("--branch", ref);
  args.push(`https://github.com/${repo}.git`, dest);
  try {
    await execFileP("git", args, { timeout: 300_000 });
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    const msg = (err.stderr || err.message).includes("already exists")
      ? `already cloned: ${dest} (rm it to re-clone)`
      : "git clone failed: " + (err.stderr || err.message).split("\n").filter(Boolean).slice(-2).join(" | ");
    throw new Error(msg);
  }
  console.log("Cloned to: " + dest);
}

async function cmdWiki(repo: string, mode: "structure" | "contents" | "ask", question?: string): Promise<void> {
  // DeepWiki's read_wiki_contents returns the whole wiki — no per-topic param.
  const tool = mode === "ask" ? "ask_question" : mode === "structure" ? "read_wiki_structure" : "read_wiki_contents";
  const args = mode === "ask" ? { repoName: repo, question } : { repoName: repo };
  const result = await mcpCall(DEEPWIKI_MCP, tool, args, deepwikiHeaders(), 90_000);
  const text = (result.content ?? []).map((c) => c.text ?? "").join("\n").trim();
  if (!text) {
    console.error("✗ DeepWiki call failed" + (looksUnauthed(result) ? " — this tool may need DEEPWIKI_MCP_API_KEY (private mode)." : " — is the repo public? Use the exact case from deepwiki.com/" + repo));
    process.exit(1);
  }
  console.log(text.slice(0, mode === "structure" ? 8_000 : 30_000));
}

async function cmdStatus(): Promise<void> {
  const key = await storedExaKey();
  console.log("Exa API key:        " + (key ? `${key.slice(0, 6)}…${key.slice(-4)} (${CONFIG_FILE})` : "none"));
  console.log("DeepWiki API key:   " + (process.env.DEEPWIKI_MCP_API_KEY ? "set (env)" : "none (public mode)"));
  console.log("agent-browser:      " + AB + (await ab(["get", "url"]).then(() => " (running)").catch(() => " (not reachable)")));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const [cmd, ...rest] = process.argv.slice(2);
try {
  switch (cmd) {
    case "search": {
      const query = rest[0];
      if (!query) throw new Error("usage: mcp-web.ts search \"query\" [numResults] [--text]");
      const numResults = parseInt(rest.find((a) => /^\d+$/.test(a)) ?? "10", 10);
      await cmdSearch(query, Math.min(numResults, 25), rest.includes("--text"));
      break;
    }
    case "fetch": {
      const url = rest[0];
      if (!url) throw new Error("usage: mcp-web.ts fetch \"https://url\"");
      await cmdFetch(url);
      break;
    }
    case "doc": {
      const target = rest[0];
      if (!target) throw new Error('usage: mcp-web.ts doc "https://.../file.pdf" or "/path/to/file.docx" — anydoc → markdown');
      await cmdDoc(target);
      break;
    }
    case "yt": {
      const url = rest[0];
      if (!url) throw new Error('usage: mcp-web.ts yt "https://youtube.com/watch?v=..." — transcript via yt-dlp');
      await cmdYt(url);
      break;
    }
    case "gh": {
      const spec = rest[0];
      if (!spec) throw new Error('usage: mcp-web.ts gh "owner/repo[@ref]" — shallow clone to /tmp');
      await cmdGh(spec);
      break;
    }
    case "wiki": {
      const repo = rest[0];
      if (!repo) throw new Error('usage: mcp-web.ts wiki "owner/repo" — topic list');
      await cmdWiki(repo, "structure");
      break;
    }
    case "wiki-read": {
      const repo = rest[0];
      if (!repo) throw new Error('usage: mcp-web.ts wiki-read "owner/repo" — full wiki');
      await cmdWiki(repo, "contents");
      break;
    }
    case "ask": {
      const [repo, ...q] = rest;
      if (!repo || q.length === 0) throw new Error('usage: mcp-web.ts ask "owner/repo" "question"');
      await cmdWiki(repo, "ask", q.join(" "));
      break;
    }
    case "auth":
      await runExaAuth();
      break;
    case "status":
      await cmdStatus();
      break;
    default:
      console.log(`mcp-web — Exa web search + DeepWiki docs

  bun mcp-web.ts search "query" [numResults] [--text]   Exa web search
  bun mcp-web.ts fetch "https://url"                    Exa page fetch (Jina Reader fallback)
  bun mcp-web.ts doc "<url-or-path>"                    PDF/Word/PPT/Excel/EPUB/CSV → markdown (firecrawl anydoc, local)
  bun mcp-web.ts yt "<youtube-url>"                     video transcript (yt-dlp, keyless)
  bun mcp-web.ts gh "owner/repo[@ref]"                  shallow-clone GitHub repo to /tmp
  bun mcp-web.ts wiki "owner/repo"                      DeepWiki topic list
  bun mcp-web.ts wiki-read "owner/repo" "topic"         DeepWiki topic contents
  bun mcp-web.ts ask "owner/repo" "question"            DeepWiki Q&A
  bun mcp-web.ts auth                                   Exa auto-auth via agent-browser
  bun mcp-web.ts status                                 key/config state`);
  }
} catch (e) {
  const err = e as Error;
  if (err.name === "TimeoutError" || err.name === "AbortError") {
    console.error("✗ Timed out (server slow or network blocked).");
    process.exit(1);
  }
  console.error("✗ " + (err.message ?? String(e)));
  process.exit(1);
}
