// Evaluation sets: eval/<set>/<category>/<file>.txt — one utterance per file.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, sep, basename } from "node:path";
import { ROOT } from "./strategies.mjs";

export function listSets() {
  const d = join(ROOT, "eval");
  return readdirSync(d, { withFileTypes: true }).filter((x) => x.isDirectory()&&!x.name.startsWith('_')).map((x) => x.name).sort();
}

/** Load all examples of a set: [{ id, category, text, file }] (id = path relative to the set). */
export function loadSet(nameOrPath) {
  const dir = existsSync(join(ROOT, "eval", nameOrPath)) ? join(ROOT, "eval", nameOrPath) : resolve(nameOrPath);
  const out = [];
  const casesFile=join(ROOT,'docs','evaluation','metadata',`${basename(dir)}.jsonl`);
  const metadata = new Map();
  if(resolve(dir)===resolve(ROOT,'eval',basename(dir))&&existsSync(casesFile)) {
    const rows=readFileSync(casesFile,'utf8').split('\n').filter(x=>x.trim()).map((line,i)=>{
      const r=JSON.parse(line);
      if(r.schema!=='nlp-eval/2'||typeof r.id!=='string'||typeof r.text!=='string'||!['formalization','conversation','judge-pair'].includes(r.kind))throw new Error(`Invalid eval record ${casesFile}:${i+1}`);
      return r;
    });
    if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error(`Duplicate IDs in ${casesFile}`);
    for (const row of rows) metadata.set(`${row.id.slice(row.id.indexOf('/')+1)}.txt`,row);
  }
  const walk = (d) => {
    for (const e of readdirSync(d).sort()) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e.endsWith(".txt")) {
        const id = relative(dir, p).split(sep).join("/");
        const text = readFileSync(p, "utf8").trim();
        if (text) {
          const annotation = metadata.get(id);
          if (annotation && annotation.text.trim() === text) {
            out.push({...annotation,text,file:p,metadataFile:casesFile});
          } else if (annotation) {
            // The visible text file is authoritative. Never attach old gold,
            // turns or context silently after the user edits an example.
            out.push({id:annotation.id,category:annotation.category,tags:annotation.tags,
              schema:'nlp-eval/2',kind:'formalization',text,file:p,
              provenance:{...annotation.provenance,annotations:'stale: source text changed'},metadataFile:casesFile});
          } else out.push({ id, category: id.includes("/") ? id.split("/").slice(0, -1).join("/") : "uncategorised", text, file: p });
        }
      }
    }
  };
  walk(dir);
  // Preserve source order for imported calibration subsets, independently of
  // filesystem enumeration. User-added text files follow the original cases.
  const order = new Map([...metadata.values()].map((row,i)=>[row.id,i]));
  if(order.size)out.sort((a,b)=>(order.get(a.id)??Infinity)-(order.get(b.id)??Infinity)||a.id.localeCompare(b.id));
  return out;
}

/** Only source/context can enter a task; references remain evaluator-private. */
export function sourceForModel(sample) {
  if(sample.turns)return JSON.stringify({turns:sample.turns});
  if(sample.context!==undefined)return JSON.stringify({context:sample.context,text:sample.text});
  return sample.text;
}
