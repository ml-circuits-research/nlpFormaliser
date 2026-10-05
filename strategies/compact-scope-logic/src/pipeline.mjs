import { fromWire, toWire } from './wire.mjs';
import { toCNL } from './cnl.mjs';
import { validate, stats } from './ir.mjs';
import { FORMALIZE_SYSTEM, JUDGE_SYSTEM, REPAIR_SYSTEM } from './prompts.mjs';

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

function normalizeJudge(j) {
  return {
    score: Math.max(0, Math.min(1, Number(j.s ?? j.score ?? 0))),
    equivalent: Boolean(j.eq ?? j.equivalent),
    missing: Array.isArray(j.miss ?? j.missing) ? (j.miss ?? j.missing) : [],
    added: Array.isArray(j.add ?? j.added) ? (j.add ?? j.added) : [],
    changed: Array.isArray(j.chg ?? j.changed) ? (j.chg ?? j.changed) : [],
    ambiguities: Array.isArray(j.amb ?? j.ambiguities) ? (j.amb ?? j.ambiguities) : []
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
    return { ir, wire: toWire(ir), cnl: toCNL(ir, cnl), judgeCNL: toCNL(ir, {compact: judgeCompact}), stats: stats(ir) };
  }

  async function judgeOnce(text, candidate) {
    const raw = await call(judge, 'judge', JUDGE_SYSTEM, `ORIGINAL:\n${text}\n\nCNL:\n${candidate.judgeCNL}`);
    return normalizeJudge(parseJsonLoose(raw));
  }

  async function repairOnce(text, candidate, audit) {
    const diff = JSON.stringify({ miss:audit.missing, add:audit.added, chg:audit.changed, amb:audit.ambiguities });
    const raw = await call(repairer, 'repair', REPAIR_SYSTEM,
      `ORIGINAL:\n${text}\n\nCURRENT_IR:\n${candidate.wire}\n\nJUDGE_DIFF:\n${diff}`);
    const ir = fromWire(stripFence(raw));
    return { ir, wire: toWire(ir), cnl: toCNL(ir, cnl), judgeCNL: toCNL(ir, {compact: judgeCompact}), stats: stats(ir) };
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
        if (audit.equivalent && audit.score >= target) break;
        candidate = await repairOnce(text, candidate, audit);
        audit = await judgeOnce(text, candidate);
        const item = { iteration: i, ...candidate, audit };
        history.push(item);
        if (item.audit.score > best.audit.score) best = item;
      }

      return {
        text,
        accepted: best.audit.equivalent && best.audit.score >= target,
        threshold: target,
        best: {
          iteration: best.iteration,
          wire: best.wire,
          cnl: best.cnl,
          judgeCNL: best.judgeCNL,
          stats: best.stats,
          audit: best.audit
        },
        history: history.map(h => ({ iteration:h.iteration, wire:h.wire, cnl:h.cnl, judgeCNL:h.judgeCNL, audit:h.audit }))
      };
    }
  };
}
