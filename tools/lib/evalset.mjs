// Evaluation sets: eval/<set>/<category>/<file>.txt — one utterance per file.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, sep, basename } from "node:path";
import { ROOT } from "./strategies.mjs";
import { consolidatedReference } from "./consolidated-reference.mjs";

export function listSets() {
  const d = join(ROOT, "eval");
  return readdirSync(d, { withFileTypes: true }).filter((x) => x.isDirectory()&&!x.name.startsWith('_')&&!['success','fail'].includes(x.name)).map((x) => x.name).sort();
}

/** Load all examples of a set: [{ id, category, text, file }] (id = path relative to the set). */
export function loadSet(nameOrPath) {
  if(['success','fail'].includes(nameOrPath))throw new Error('CNL result mirrors are not input corpora');
  const archived=join(ROOT,'docs','evaluation','atomic',nameOrPath);
  const dir = existsSync(join(ROOT, "eval", nameOrPath)) ? join(ROOT, "eval", nameOrPath) : existsSync(archived)?archived:resolve(nameOrPath);
  const out = [];
  const casesFile=join(ROOT,'docs','evaluation','metadata',`${basename(dir)}.jsonl`);
  const metadata = new Map();
  if([resolve(ROOT,'eval',basename(dir)),resolve(ROOT,'docs','evaluation','atomic',basename(dir))].includes(resolve(dir))&&existsSync(casesFile)) {
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
  return attachAtomicReferences(out);
}

// Consolidated documents store `reference:{}`; their atomic probes and gold
// live with the source records. Attach them (with spans) at load time.
function attachAtomicReferences(rows) {
  const cache=new Map();
  const lookup=(set,id)=>{
    if(!cache.has(set))cache.set(set,new Map(loadSet(set).map(r=>[r.id,r])));
    return cache.get(set).get(id);
  };
  return rows.map(row=>row.construction?.sources?.length&&!Object.keys(row.reference??{}).length&&!row.provenance?.annotations?.startsWith('stale')
    ?{...row,reference:consolidatedReference(row,lookup)}:row);
}

/** Only source/context can enter a task; references remain evaluator-private. */
export function sourceForModel(sample) {
  if(sample.modelInput!==undefined)throw new Error('Stored rows carry their model input; use modelInputFor');
  if(sample.turns)return JSON.stringify({turns:sample.turns});
  if(sample.context!==undefined)return JSON.stringify({context:sample.context,text:sample.text});
  return sample.text;
}

/**
 * The exact string a formalizer received. Saved rows (rejudge/resume) carry it
 * in `modelInput` (or legacy `text`, which formalizeToCNL stores verbatim) and
 * must never be wrapped again; fresh cases are encoded once by sourceForModel.
 */
export function modelInputFor(item,{stored=false}={}) {
  if(item.modelInput!==undefined)return item.modelInput;
  if(stored){if(typeof item.text!=='string')throw new Error(`Stored row lacks its model input: ${item.id}`);return item.text;}
  return sourceForModel(item);
}
