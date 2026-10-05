// LLM providers. An LLM is just an async function (system, prompt) => text, so you can plug in anything.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const HAIKU = "claude-haiku-4-5";
export const SONNET = "claude-sonnet-5-5";

/** Official Anthropic SDK (npm i @anthropic-ai/sdk; needs ANTHROPIC_API_KEY or another SDK credential). */
export function anthropicLLM({ model = HAIKU, maxTokens = 4096, client } = {}) {
  let c = client;
  return async (system, prompt) => {
    if (!c) {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      c = new Anthropic();
    }
    const msg = await c.messages.create({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] });
    return msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  };
}

/** Headless Claude Code CLI (`claude -p`) — useful where Claude Code is logged in but no API key is set. */
export function claudeCliLLM({ model = HAIKU, bin = "claude", timeoutMs = 300_000 } = {}) {
  return (system, prompt) => new Promise((resolve, reject) => {
    const p = spawn(bin, ["-p", "--model", model, "--system-prompt", system, "--tools", "", "--output-format", "json"],
      { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const t = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", () => {
      clearTimeout(t);
      try {
        const d = JSON.parse(out);
        if (d.is_error) return reject(new Error(String(d.result).slice(0, 300)));
        resolve(d.result);
      } catch { reject(new Error(`claude CLI failed: ${err.slice(-300) || out.slice(-300)}`)); }
    });
    p.stdin.end(prompt);
  });
}

/** Pick a provider: SDK if ANTHROPIC_API_KEY is set, otherwise the `claude` CLI. */
export function defaultLLM({ model = HAIKU } = {}) {
  return process.env.ANTHROPIC_API_KEY ? anthropicLLM({ model }) : claudeCliLLM({ model });
}

/** Wrap an LLM with a disk cache (key = sha256 of tag+system+prompt). */
export function cachedLLM(llm, dir, tag = "") {
  return async (system, prompt) => {
    const k = createHash("sha256").update(`${tag}\0${system}\0${prompt}`).digest("hex");
    const f = join(dir, `${k}.json`);
    try { return JSON.parse(await readFile(f, "utf8")).text; } catch { /* miss */ }
    const text = await llm(system, prompt);
    await mkdir(dir, { recursive: true });
    await writeFile(f, JSON.stringify({ text }));
    return text;
  };
}

/** Content of the last fenced code block (or the raw text). */
export function extractBlock(text) {
  const blocks = [...text.matchAll(/```(?:[a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g)].map((m) => m[1]);
  return (blocks.length ? blocks.at(-1) : text).trim();
}

/** First JSON object in the text. */
export function extractJson(text) {
  for (const cand of [extractBlock(text), text]) {
    const m = /\{[\s\S]*\}/.exec(cand);
    if (m) { try { return JSON.parse(m[0]); } catch { /* next */ } }
  }
  throw new Error(`no JSON in: ${text.slice(0, 200)}`);
}
