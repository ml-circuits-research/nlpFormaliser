/**
 * Semantic LLM judge for NL -> CNL candidates.
 * Dependency-free; Node.js >= 20 (native fetch).
 *
 * This module deliberately does not generate CNL. It validates the output of the
 * symbolic formalizer by comparing the original NL with a readable canonical CNL.
 */

import {
  auditTurn,
  helperIssues,
  validateAst,
} from './formalizer.mjs';

export const JUDGE_PROTOCOL = 'nl2cnl-semantic-judge/1';

const SEVERITY_RANK = { low: 1, medium: 2, high: 3 };

function cleanText(x) {
  return String(x ?? '').replace(/\r/g, '').trim();
}

function stableSample(index, fraction) {
  if (fraction <= 0) return false;
  if (fraction >= 1) return true;
  // deterministic pseudo-random sample, stable across runs
  return ((index * 73 + 19) % 1000) < Math.round(fraction * 1000);
}

function asTurns(conversation) {
  if (Array.isArray(conversation)) return conversation;
  return conversation?.turns ?? [];
}

function maxIssueSeverity(turn) {
  let rank = 0;
  for (const a of turn?.ambiguities ?? []) rank = Math.max(rank, SEVERITY_RANK[a.severity] ?? 0);
  return rank;
}

/**
 * Choose which turns deserve LLM review.
 * policy:
 *   - all: every candidate
 *   - risky: symbolic warnings/audit failures only
 *   - sampled: risky + deterministic sample of apparently safe candidates
 */
export function selectTurnsForJudge(conversation, {
  policy = 'sampled',
  minSeverity = 'medium',
  safeSampleRate = 0.15,
} = {}) {
  const turns = asTurns(conversation);
  const threshold = SEVERITY_RANK[minSeverity] ?? 2;
  return turns.filter((turn, i) => {
    if (policy === 'all') return true;
    const audit = auditTurn(turn);
    const risky = !audit.ok || maxIssueSeverity(turn) >= threshold || helperIssues(turn, { minSeverity }).length > 0;
    if (policy === 'risky') return risky;
    return risky || stableSample(i, safeSampleRate);
  });
}

function localContext(turns, index, before, after) {
  const out = [];
  const start = Math.max(0, index - before);
  const end = Math.min(turns.length - 1, index + after);
  for (let i = start; i <= end; i++) {
    if (i === index) continue;
    const t = turns[i];
    out.push({ id: t.id, speaker: t.speaker ?? null, text: t.source ?? t.text ?? '' });
  }
  return out;
}

function judgeItem(turn, turns, index, { contextBefore = 3, contextAfter = 0, includeSymbolicAudit = true } = {}) {
  const audit = auditTurn(turn);
  return {
    turn_id: turn.id,
    speaker: turn.speaker ?? null,
    source_nl: turn.source,
    candidate_cnl: turn.final_cnl ?? turn.cnl,
    context: localContext(turns, index, contextBefore, contextAfter),
    symbolic_warnings: (turn.ambiguities ?? []).map(a => ({
      kind: a.kind,
      severity: a.severity,
      span: a.span,
      question: a.question ?? null,
      options: a.options ?? [],
    })),
    symbolic_audit: includeSymbolicAudit ? {
      ok: audit.ok,
      hard_failures: audit.hard_failures,
      failed_checks: audit.checks.filter(x => !x.ok).map(x => ({ name: x.name, detail: x.detail, severity: x.severity })),
    } : undefined,
  };
}

export function buildJudgeBatches(conversation, {
  policy = 'sampled',
  minSeverity = 'medium',
  safeSampleRate = 0.15,
  contextBefore = 3,
  contextAfter = 0,
  includeSymbolicAudit = true,
  maxItems = 64,
  maxChars = 120_000,
} = {}) {
  const turns = asTurns(conversation);
  const selected = new Set(selectTurnsForJudge(conversation, { policy, minSeverity, safeSampleRate }).map(t => t.id));
  const items = [];
  for (let i = 0; i < turns.length; i++) {
    if (!selected.has(turns[i].id)) continue;
    items.push(judgeItem(turns[i], turns, i, { contextBefore, contextAfter, includeSymbolicAudit }));
  }

  const chunks = [];
  let cur = [], chars = 0;
  for (const item of items) {
    const n = JSON.stringify(item).length;
    if (cur.length && (cur.length >= maxItems || chars + n > maxChars)) {
      chunks.push(cur); cur = []; chars = 0;
    }
    cur.push(item); chars += n;
  }
  if (cur.length) chunks.push(cur);

  return chunks.map((batch, i) => ({
    protocol: JUDGE_PROTOCOL,
    batch_id: `judge-${i + 1}`,
    task: 'judge_semantic_equivalence_of_nl_and_cnl',
    items: batch,
  }));
}

export function judgeSystemPrompt({ requestRepair = false } = {}) {
  return `You are a strict semantic equivalence judge for a natural-language-to-controlled-natural-language formalizer.

Your job is NOT to prefer fluent wording. Compare SOURCE_NL with CANDIDATE_CNL as semantic structures in the supplied conversational context.

A candidate is equivalent only if it preserves all material meaning that is explicit or contextually resolved in SOURCE_NL and does not add material meaning not licensed by SOURCE_NL/context.

Check independently:
1. speech act / intent (assertion, question, request, instruction, goal, preference, correction, confirmation);
2. entities and identity/coreference;
3. predicates/events and semantic roles (agent, theme, recipient, source, destination, instrument, location);
4. quantifiers and cardinality (every, some, no, only, at least/exactly/etc. when present);
5. negation and operator scope;
6. modality/deontics/epistemics (must, may, should, can, belief, knowledge, uncertainty);
7. conditions, alternatives, conjunction/disjunction;
8. temporal order, deadlines, duration/aspect when materially stated;
9. causality/purpose;
10. comparisons, constraints, exclusions;
11. information omitted from CNL;
12. information invented by CNL.

Do not infer unstated facts from world knowledge. Do not accept a candidate merely because it is a plausible paraphrase. If context does not resolve a reference or scope choice, verdict must be "uncertain" rather than guessing.

Return JSON only, exactly one result per turn_id. Use concise evidence spans. ${requestRepair ? 'For non-equivalent items, you may also provide a corrected_cnl string only when the repair is unambiguous from source/context; otherwise corrected_cnl must be null.' : 'Do not rewrite the CNL.'}`;
}

export function judgeUserPayload(batch, { requestRepair = false } = {}) {
  return {
    protocol: JUDGE_PROTOCOL,
    batch_id: batch.batch_id,
    required_output: {
      protocol: JUDGE_PROTOCOL,
      batch_id: batch.batch_id,
      results: [{
        turn_id: 'same as input',
        verdict: 'equivalent | not_equivalent | uncertain',
        confidence: 'number 0..1',
        missing: [{ source_span: '...', meaning: '...' }],
        invented: [{ cnl_span: '...', meaning: '...' }],
        scope_errors: ['...'],
        reference_errors: ['...'],
        speech_act_error: 'string or null',
        reason: 'short explanation',
        ...(requestRepair ? { corrected_cnl: 'string or null' } : {}),
      }],
    },
    items: batch.items,
  };
}

function extractJson(text) {
  if (typeof text !== 'string') return text;
  const s = text.trim();
  try { return JSON.parse(s); } catch {}
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch {}
  }
  const first = s.indexOf('{'), last = s.lastIndexOf('}');
  if (first >= 0 && last > first) return JSON.parse(s.slice(first, last + 1));
  throw new Error('LLM response does not contain a JSON object');
}

export function validateJudgeResponse(batch, response) {
  const obj = extractJson(response);
  const errors = [];
  if (!obj || obj.protocol !== JUDGE_PROTOCOL) errors.push(`protocol must be ${JUDGE_PROTOCOL}`);
  if (obj?.batch_id !== batch.batch_id) errors.push(`batch_id must be ${batch.batch_id}`);
  if (!Array.isArray(obj?.results)) errors.push('results must be an array');

  const expected = new Set(batch.items.map(x => x.turn_id));
  const seen = new Set();
  for (const r of obj?.results ?? []) {
    if (!expected.has(r.turn_id)) errors.push(`unexpected turn_id ${r.turn_id}`);
    if (seen.has(r.turn_id)) errors.push(`duplicate turn_id ${r.turn_id}`);
    seen.add(r.turn_id);
    if (!['equivalent', 'not_equivalent', 'uncertain'].includes(r.verdict)) errors.push(`${r.turn_id}: invalid verdict`);
    if (typeof r.confidence !== 'number' || r.confidence < 0 || r.confidence > 1) errors.push(`${r.turn_id}: confidence must be 0..1`);
    for (const key of ['missing', 'invented', 'scope_errors', 'reference_errors']) {
      if (!Array.isArray(r[key])) errors.push(`${r.turn_id}: ${key} must be an array`);
    }
    if (!('speech_act_error' in r)) errors.push(`${r.turn_id}: speech_act_error missing`);
    if (typeof r.reason !== 'string') errors.push(`${r.turn_id}: reason must be a string`);
  }
  for (const id of expected) if (!seen.has(id)) errors.push(`missing result for ${id}`);
  return { ok: errors.length === 0, errors, response: obj };
}

/**
 * Generic driver: caller supplies callLLM({system,user,batch}) -> string|object.
 * This makes the library independent from any model/provider.
 */
export async function judgeBatch(batch, {
  callLLM,
  requestRepair = false,
} = {}) {
  if (typeof callLLM !== 'function') throw new TypeError('judgeBatch requires callLLM({system,user,batch})');
  const system = judgeSystemPrompt({ requestRepair });
  const userObj = judgeUserPayload(batch, { requestRepair });
  const raw = await callLLM({ system, user: JSON.stringify(userObj), batch });
  const checked = validateJudgeResponse(batch, raw);
  if (!checked.ok) throw new Error(`Invalid judge response: ${checked.errors.join('; ')}`);
  return checked.response;
}

export async function judgeBatches(batches, options = {}) {
  const responses = [];
  for (const batch of batches) responses.push(await judgeBatch(batch, options));
  return responses;
}

export function indexJudgeResults(responses) {
  const map = new Map();
  for (const response of responses ?? []) {
    for (const r of response?.results ?? []) map.set(r.turn_id, r);
  }
  return map;
}

export function combineValidation(conversation, judgeResponses = [], {
  equivalentConfidence = 0.80,
  requireJudgeForAcceptance = false,
} = {}) {
  const turns = asTurns(conversation);
  const judged = indexJudgeResults(judgeResponses);
  return {
    turns: turns.map(turn => {
      const audit = auditTurn(turn);
      const j = judged.get(turn.id) ?? null;
      let status;
      if (j?.verdict === 'not_equivalent') status = 'rejected';
      else if (j?.verdict === 'uncertain') status = 'uncertain';
      else if (j?.verdict === 'equivalent' && j.confidence >= equivalentConfidence && audit.ok) status = 'accepted';
      else if (j?.verdict === 'equivalent') status = audit.ok ? 'accepted_low_confidence' : 'symbolic_conflict';
      else if (!audit.ok) status = 'needs_review';
      else status = requireJudgeForAcceptance ? 'not_judged' : 'symbolically_accepted';
      return {
        ...turn,
        validation: {
          status,
          symbolic: audit,
          judge: j,
        },
      };
    }),
  };
}

/**
 * One convenience function for experiments.
 * It keeps formalization and semantic judging logically separate.
 */
export async function formalizeAndJudge(conversation, {
  formalizeConversation,
  judgeOptions = {},
  callLLM,
  requestRepair = false,
  combineOptions = {},
} = {}) {
  if (typeof formalizeConversation !== 'function') throw new TypeError('formalizeConversation function is required');
  const formalized = formalizeConversation(conversation);
  const batches = buildJudgeBatches(formalized, judgeOptions);
  const responses = await judgeBatches(batches, { callLLM, requestRepair });
  return {
    formalized,
    judge_batches: batches,
    judge_responses: responses,
    validated: combineValidation(formalized, responses, combineOptions),
  };
}

export function validateCandidateAst(turn) {
  return validateAst(turn?.content ?? turn?.final_content ?? null);
}
