import { fromWire, toWire } from './wire.mjs';
import { toCNL } from './cnl.mjs';
import { validate, stats } from './ir.mjs';
import { FORMALIZE_SYSTEM, JUDGE_SYSTEM, REPAIR_SYSTEM } from './prompts.mjs';
import { microSymbolViolations } from './symbols.mjs';
import { decompositionFeedback } from '../../../tools/lib/symbols.mjs';

function stripFence(x) {
  return String(x).trim().replace(/^```(?:json|javascript|js|mjs)?\s*/,'').replace(/\s*```$/,'').trim();
}

function parseJsonLoose(x) {
  const s = stripFence(x);
  try { return JSON.parse(s); } catch {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(s.slice(a,b+1));
  throw new SyntaxError('Judge did not return JSON');
}

// Strict judge schema: a string "false" must not become true via Boolean().
function normalizeJudge(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new TypeError('Judge reply must be a JSON object');
  const score = j.s ?? j.score;
  const equivalent = j.eq ?? j.equivalent;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1) throw new TypeError('Judge score must be a number in [0,1]');
  if (typeof equivalent !== 'boolean') throw new TypeError('Judge eq must be a boolean');
  const list = (a, b) => {
    const v = j[a] ?? j[b] ?? [];
    if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) throw new TypeError(`Judge ${a} must be an array of strings`);
    return v;
  };
  return {
    score, equivalent,
    missing: list('miss', 'missing'),
    added: list('add', 'added'),
    changed: list('chg', 'changed'),
    ambiguities: list('amb', 'ambiguities')
  };
}

async function call(adapter, role, system, user) {
  if (typeof adapter !== 'function') throw new TypeError(`${role} adapter must be a function`);
  return adapter({ role, system, user });
}

export function createPipeline({
  formalizer,
  judge,
  repairer = formalizer,
  threshold = 0.985,
  maxRepairs = 1,
  cnl = { compact: false },
  judgeCompact = true
}) {
  if (!formalizer || !judge) throw new TypeError('formalizer and judge adapters are required');

  async function formalizeOnce(text) {
    const raw = await call(formalizer, 'formalize', FORMALIZE_SYSTEM, `TEXT:\n${text}`);
    const ir = fromWire(stripFence(raw));
    const check = validate(ir);
    if (!check.ok) throw new SyntaxError(check.errors.join('; '));
    return { ir, wire: toWire(ir), cnl: toCNL(ir, cnl), judgeCNL: toCNL(ir, {compact: judgeCompact}), stats: stats(ir), symbols: decompositionFeedback(microSymbolViolations(ir)) };
  }

  async function judgeOnce(text, candidate) {
    const raw = await call(judge, 'judge', JUDGE_SYSTEM, `ORIGINAL:\n${text}\n\nCNL:\n${candidate.judgeCNL}`);
    return normalizeJudge(parseJsonLoose(raw));
  }

  async function repairOnce(text, candidate, audit) {
    const diff = JSON.stringify({ miss:audit.missing, add:audit.added, chg:audit.changed, amb:audit.ambiguities, sym:candidate.symbols ?? [] });
    const raw = await call(repairer, 'repair', REPAIR_SYSTEM,
      `ORIGINAL:\n${text}\n\nCURRENT_IR:\n${candidate.wire}\n\nJUDGE_DIFF:\n${diff}`);
    const ir = fromWire(stripFence(raw));
    return { ir, wire: toWire(ir), cnl: toCNL(ir, cnl), judgeCNL: toCNL(ir, {compact: judgeCompact}), stats: stats(ir), symbols: decompositionFeedback(microSymbolViolations(ir)) };
  }

  return {
    formalizeOnce,
    judgeOnce,
    async run(text, opts = {}) {
      const limit = opts.maxRepairs ?? maxRepairs;
      const target = opts.threshold ?? threshold;
      const history = [];
      let candidate = await formalizeOnce(text);
      let audit = await judgeOnce(text, candidate);
      history.push({ iteration: 0, ...candidate, audit });
      let best = history[0];

      for (let i = 1; i <= limit; i++) {
        // A symbol-length violation is a deterministic repair trigger.
        if (audit.equivalent && audit.score >= target && !candidate.symbols.length) break;
        candidate = await repairOnce(text, candidate, audit);
        audit = await judgeOnce(text, candidate);
        const item = { iteration: i, ...candidate, audit };
        history.push(item);
        const rank = h => [h.symbols.length === 0 ? 1 : 0, h.audit.score];
        const [a, b] = [rank(item), rank(best)];
        if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])) best = item;
      }

      return {
        text,
        accepted: best.audit.equivalent && best.audit.score >= target && !best.symbols.length,
        threshold: target,
        best: {
          iteration: best.iteration,
          wire: best.wire,
          cnl: best.cnl,
          judgeCNL: best.judgeCNL,
          stats: best.stats,
          symbols: best.symbols,
          audit: best.audit
        },
        history: history.map(h => ({ iteration:h.iteration, wire:h.wire, cnl:h.cnl, judgeCNL:h.judgeCNL, symbols:h.symbols, audit:h.audit }))
      };
    }
  };
}
