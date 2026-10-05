// Evaluation sets: eval/<set>/<category>/<file>.txt — one utterance per file.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { ROOT } from "./strategies.mjs";

export function listSets() {
  const d = join(ROOT, "eval");
  return readdirSync(d, { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => x.name).sort();
}

/** Load all examples of a set: [{ id, category, text, file }] (id = path relative to the set). */
export function loadSet(nameOrPath) {
  const dir = existsSync(join(ROOT, "eval", nameOrPath)) ? join(ROOT, "eval", nameOrPath) : resolve(nameOrPath);
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d).sort()) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e.endsWith(".txt")) {
        const id = relative(dir, p).split(sep).join("/");
        const text = readFileSync(p, "utf8").trim();
        if (text) out.push({ id, category: id.includes("/") ? id.split("/").slice(0, -1).join("/") : "uncategorised", text, file: p });
      }
    }
  };
  walk(dir);
  return out;
}
