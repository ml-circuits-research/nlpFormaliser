// camelCase is split before lowercasing so that it cannot hide extra words from
// the 3-word symbol rule; non-Latin letters are kept instead of collapsing to "".
export function slug(value) {
  return String(value ?? "")
    .trim()
    .replace(/(\p{Ll})(\p{Lu})/gu, "$1_$2")
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, "$1_$2")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\s*(the|a|an)\s+/i, "")
    .replace(/[^\p{L}\p{N}?]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

export function humanize(value) {
  const s = String(value ?? "").replace(/^\?/, "").replace(/_/g, " ");
  if (!s) return "";
  return s;
}

export function isVariable(value) {
  return typeof value === "string" && value.startsWith("?");
}

export function stableStringify(value) {
  const seen = new WeakSet();
  const sort = (x) => {
    if (x === null || typeof x !== "object") return x;
    if (seen.has(x)) throw new TypeError("Cannot stableStringify cyclic data");
    seen.add(x);
    if (Array.isArray(x)) return x.map(sort);
    return Object.fromEntries(Object.keys(x).sort().map((k) => [k, sort(x[k])]));
  };
  return JSON.stringify(sort(value));
}

export function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function median(xs) {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export function stddev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export function extractJsonObject(text) {
  const s = String(text ?? "").trim();
  if (!s) throw new Error("Empty model response");
  try { return JSON.parse(s); } catch {}
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch {}
  }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) return JSON.parse(s.slice(first, last + 1));
  throw new Error("Could not locate a JSON object in model response");
}

export function parseArgs(argv) {
  const out = {_: []};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) { out[key] = next; i += 1; }
    else out[key] = true;
  }
  return out;
}
