// Shared CLI helpers: LLM selection, --opt key=value parsing, reading text arguments.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { anthropicLLM, cachedLLM, claudeCliLLM } from "./llm.mjs";
import { ROOT } from "./strategies.mjs";

export const DEFAULT_MODEL = "claude-haiku-4-5";
export const DEFAULT_JUDGE_MODEL = "claude-sonnet-5-5";

/** LLM for a model: Anthropic SDK if ANTHROPIC_API_KEY is set (or --provider sdk), else the `claude` CLI. Cached on disk. */
export function makeLLM(model, { provider, cache = join(ROOT, ".llm_cache") } = {}) {
  const useSdk = provider === "sdk" || (provider !== "cli" && process.env.ANTHROPIC_API_KEY);
  const llm = useSdk ? anthropicLLM({ model }) : claudeCliLLM({ model });
  return cache === false || cache === "none" ? llm : cachedLLM(llm, cache, model);
}

export function parseOpts(list = []) {
  const o = {};
  for (const kv of list) {
    const i = kv.indexOf("=");
    const k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? "true" : kv.slice(i + 1);
    o[k] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v === "true" ? true : v === "false" ? false : v;
  }
  return o;
}

/** A file path or literal text; "-" reads stdin. */
export const readArg = (x) => (x === undefined || x === "-" ? readFileSync(0, "utf8") : existsSync(x) ? readFileSync(x, "utf8") : x).trim();
