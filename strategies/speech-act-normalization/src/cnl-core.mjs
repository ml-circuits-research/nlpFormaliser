/**
 * CNL-Core Baseline
 * Dependency-free helpers for NL -> Controlled Natural English workflows.
 *
 * This library does NOT formalize natural language itself. It provides:
 *   - the frozen CNL-Core Baseline contract,
 *   - prompt construction for an LLM formalizer,
 *   - parsing and format validation,
 *   - canonicalization for regression testing.
 */

export const VERSION = '0.1.0';

export const LINE_TYPES = Object.freeze([
  'ASSERT',
  'ASK',
  'REQUEST',
  'INTEND',
  'PREFER',
  'PROPOSE',
  'REVISE',
  'UNCLEAR'
]);

export const RULES = Object.freeze([
  'Preserve all meaning explicitly stated in the input.',
  'Do not infer new facts, consequences, causes, identities, goals, or relations.',
  'Use exactly one CNL-Core line per main semantic unit.',
  'Use only these line types: ASSERT, ASK, REQUEST, INTEND, PREFER, PROPOSE, REVISE, UNCLEAR.',
  'Preserve negation, quantifiers, modality, uncertainty, attribution, conditions, exceptions, comparisons, and temporal relations.',
  'Keep semantic scope intact. Do not rewrite "not every" as "no", or otherwise strengthen/weaken a statement.',
  'Prefer an explicit subject and explicit referents when they are unambiguous.',
  'Resolve pronouns only when the referent is unambiguous from the supplied text/context.',
  'If a material reference or interpretation is ambiguous, use a neutral placeholder such as PERSON_1, OBJECT_1, EVENT_1 and add an UNCLEAR line.',
  'Remove only purely social/filler wording that carries no task, stance, uncertainty, attribution, preference, intention, or factual content.',
  'Do not remove hedges such as probably, possibly, apparently, I think, I guess, or reported attribution when they affect meaning.',
  'Interpret a polite question as REQUEST only when its pragmatic function is clearly a request; otherwise keep ASK.',
  'Questions remain questions. Do not answer them.',
  'Instructions remain requests. Do not execute them.',
  'Intentions, preferences, proposals, revisions, and uncertainty must not be silently converted into plain assertions.',
  'Write simple controlled English. Do not output JSON, logic, RDF, predicates, code, explanations, headings, bullets, or markdown.'
]);

export const DEFAULT_EXAMPLES = Object.freeze([
  {
    input: 'Well, okay, could you run the test?',
    output: 'REQUEST: You run the test.'
  },
  {
    input: 'I think Luna is probably good enough, but do not switch yet.',
    output: [
      'ASSERT: I think Luna is probably good enough.',
      'REQUEST: You do not switch yet.'
    ].join('\n')
  },
  {
    input: 'Not every user has access.',
    output: 'ASSERT: Not every user has access.'
  },
  {
    input: 'Maria told Ana that she should leave.',
    output: [
      'ASSERT: Maria told Ana that PERSON_1 should leave.',
      'UNCLEAR: PERSON_1 refers to Maria or Ana.'
    ].join('\n')
  },
  {
    input: 'Let\'s use Luna first. If accuracy is below 95%, switch to Sol.',
    output: [
      'PROPOSE: We use Luna first.',
      'REQUEST: If accuracy is below 95%, then you switch to Sol.'
    ].join('\n')
  },
  {
    input: 'Actually, the deadline is Monday, not Friday.',
    output: 'REVISE: The deadline is Monday, not Friday.'
  }
]);

function cleanContext(context) {
  if (!context) return '';
  if (Array.isArray(context)) return context.filter(Boolean).join('\n');
  return String(context).trim();
}

/** Build a compact but strict prompt suitable for a small LLM. */
export function buildFormalizationPrompt(input, options = {}) {
  const {
    context = '',
    examples = DEFAULT_EXAMPLES,
    includeRules = true,
    extraRules = [],
    includeInput = true,
    modelNote = 'Return only CNL-Core lines.'
  } = options;

  const parts = [
    'You are a precise natural-language normalizer.',
    'Convert the supplied text into CNL-Core Baseline.',
    'CNL-Core is controlled English, not symbolic logic.',
    `Allowed line types: ${LINE_TYPES.join(', ')}.`
  ];

  if (includeRules) {
    parts.push('', 'Rules:');
    [...RULES, ...extraRules].forEach((rule, i) => parts.push(`${i + 1}. ${rule}`));
  }

  if (examples && examples.length) {
    parts.push('', 'Examples:');
    for (const ex of examples) {
      parts.push('INPUT:');
      parts.push(String(ex.input).trim());
      parts.push('OUTPUT:');
      parts.push(String(ex.output).trim());
      parts.push('---');
    }
  }

  const c = cleanContext(context);
  if (c) {
    parts.push('', 'CONTEXT:');
    parts.push(c);
  }

  // A predefined task template supplies its input separately; it must not carry
  // an empty INPUT: block.
  if (includeInput) {
    parts.push('', 'INPUT:');
    parts.push(String(input ?? '').trim());
  }
  parts.push('', modelNote);
  return parts.join('\n');
}

/** Parse CNL-Core text into [{type, text, raw, line}]. */
export function parseCNL(text) {
  const source = String(text ?? '').replace(/\r\n?/g, '\n');
  const lines = source.split('\n');
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const m = raw.match(/^([A-Z]+):\s*(.+)$/);
    if (!m) {
      items.push({ type: null, text: raw, raw, line: i + 1 });
      continue;
    }
    items.push({ type: m[1], text: m[2].trim(), raw, line: i + 1 });
  }
  return items;
}

/**
 * Validate only the CNL-Core surface contract.
 * No semantic reasoning is attempted.
 */
export function validateCNL(text, options = {}) {
  const { requireTerminalPunctuation = true } = options;
  const items = parseCNL(text);
  const errors = [];
  const warnings = [];

  if (items.length === 0) {
    errors.push({ code: 'EMPTY', message: 'No CNL-Core lines found.' });
    return { ok: false, errors, warnings, items };
  }

  for (const item of items) {
    if (!item.type) {
      errors.push({
        code: 'BAD_PREFIX',
        line: item.line,
        message: 'Each non-empty line must start with an allowed TYPE: prefix.'
      });
      continue;
    }
    if (!LINE_TYPES.includes(item.type)) {
      errors.push({
        code: 'UNKNOWN_TYPE',
        line: item.line,
        type: item.type,
        message: `Unknown line type ${item.type}.`
      });
    }
    if (!item.text) {
      errors.push({ code: 'EMPTY_BODY', line: item.line, message: 'Line body is empty.' });
    }
    if (requireTerminalPunctuation && item.text && !/[.!?]$/.test(item.text)) {
      warnings.push({
        code: 'NO_TERMINAL_PUNCTUATION',
        line: item.line,
        message: 'Controlled-English lines should normally end with punctuation.'
      });
    }
    if (/^[-*]\s/.test(item.raw) || /^```/.test(item.raw)) {
      errors.push({
        code: 'MARKDOWN_NOT_ALLOWED',
        line: item.line,
        message: 'Markdown bullets/fences are not part of CNL-Core.'
      });
    }
  }

  return { ok: errors.length === 0, errors, warnings, items };
}

/** Stable formatting useful for storage and comparison. */
export function formatCNL(items) {
  return items
    .filter(x => x && x.type && x.text)
    .map(x => `${x.type}: ${String(x.text).trim()}`)
    .join('\n');
}

/** Conservative canonicalization for exact regression tests, not semantic equivalence. */
export function canonicalizeCNL(text) {
  const items = parseCNL(text);
  return items
    .map(item => {
      if (!item.type) return item.raw.replace(/\s+/g, ' ').trim();
      return `${item.type}: ${item.text.replace(/\s+/g, ' ').trim()}`;
    })
    .join('\n')
    .trim();
}

export function typeCounts(text) {
  const counts = Object.fromEntries(LINE_TYPES.map(t => [t, 0]));
  for (const item of parseCNL(text)) {
    if (item.type && counts[item.type] !== undefined) counts[item.type]++;
  }
  return counts;
}

/**
 * A deliberately shallow diagnostic for model output.
 * It reports format properties only and does not claim semantic correctness.
 */
export function inspectOutput(text) {
  const validation = validateCNL(text);
  return {
    version: VERSION,
    valid: validation.ok,
    lineCount: validation.items.length,
    typeCounts: typeCounts(text),
    errors: validation.errors,
    warnings: validation.warnings
  };
}
