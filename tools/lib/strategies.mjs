// Loading formalisation strategies from strategies/<name>/index.mjs.
import { readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {REGISTRY,resolveStrategy} from './registry.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const STRATEGIES_DIR = join(ROOT, "strategies");

/** Names of all strategies (folders with an index.mjs). */
export function listStrategies({includeRepair=false}={}) {
  return Object.entries(REGISTRY).filter(([,s])=>includeRepair||!s.repair).map(([id])=>id);
}

/** Load and validate a strategy module. `nameOrPath` is a folder name under strategies/ or a path. */
export async function loadStrategy(nameOrPath) {
  const registration=resolveStrategy(nameOrPath);
  const dir = registration?join(STRATEGIES_DIR,registration.folder):resolve(nameOrPath);
  const mod = await import(pathToFileURL(join(dir, "index.mjs")).href);
  const s = mod.default;
  const problems = [];
  if (!s || typeof s !== "object") problems.push("index.mjs must `export default` a strategy object");
  else {
    if (typeof s.name !== "string") problems.push("missing `name`");
    if (typeof s.formalize !== "function") problems.push("missing `formalize(text, ctx)`");
    if (typeof s.toCNL !== "function") problems.push("missing `toCNL(formalization, ctx)`");
  }
  if (problems.length) throw new Error(`invalid strategy at ${dir}: ${problems.join("; ")}`);
  return {...s,...(registration?{name:registration.id,title:registration.title,family:registration.family,repair:!!registration.repair}:{}),directory:dir,taskFile:join(dir,'task.mjs')};
}

/**
 * Run a strategy on one text: NL → formalisation → (check) → CNL.
 * Never throws: failures are reported in the result.
 */
export async function formalizeToCNL(strategy, text, ctx = {}) {
  const t0 = Date.now();
  const out = { strategy: strategy.name, text, formalization: null, cnl: null, ok: false, errors: [], extra: {} };
  try {
    const r = await strategy.formalize(text, ctx);
    const { formalization, ...extra } = typeof r === "string" ? { formalization: r } : r;
    out.formalization = formalization;
    out.extra = extra;
    if (strategy.check) {
      const c = await strategy.check(formalization, ctx);
      if (!c.ok) out.errors.push(...(c.errors ?? ["invalid formalisation"]));
    }
    if (!out.errors.length) {
      out.cnl = String(await strategy.toCNL(formalization, ctx)).trim();
      out.ok = out.cnl.length > 0;
      if (!out.ok) out.errors.push("empty CNL");
      if (out.ok && strategy.toReasoning) out.reasoning = await strategy.toReasoning(formalization, ctx);
    }
  } catch (e) {
    out.ok = false;
    out.failure = /status \d+|unreachable|unavailable|no answer within|ECONN|fetch failed/i.test(e.message) ? 'infrastructure' : /LLM disabled/.test(e.message) ? 'offline' : 'formalization';
    out.errors.push(`${e.name}: ${e.message}`);
  }
  out.seconds = (Date.now() - t0) / 1000;
  return out;
}
