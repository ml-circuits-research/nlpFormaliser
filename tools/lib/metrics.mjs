import {rowFailure} from './failures.mjs';
import {ISSUE_CATEGORIES} from './audit.mjs';
// Missing annotations are not perfect scores. Overlapping tags are reported
// independently and must never be summed as disjoint case counts.
export function summarizeRows(rows) {
  const count = predicate => rows.filter(predicate).length;
  const tests = rows.flatMap(row => row.referenceEvaluation?.behavior?.rows ?? []);
  const annotated = rows.reduce((sum,row)=>sum+(row.reference?.behavior?.length??0),0);
  const outcome = row => row.verdict?.outcome ?? (row.verdict?.equivalent === true ? 'equivalent' : row.verdict?.equivalent === false ? 'not_equivalent' : row.verdict?.status === 'judged' ? 'uncertain' : null);
  return {
    n: rows.length,
    valid: count(row => row.ok),
    // Failure classes: only formalizationFailures are evidence about a strategy.
    formalizationFailures: count(row => rowFailure(row) === 'formalization'),
    budgetFailures: count(row => rowFailure(row) === 'budget'),
    infrastructureFailures: count(row => rowFailure(row) === 'infrastructure'),
    notRunOffline: count(row => rowFailure(row) === 'offline'),
    // Eligibility (reasoning-export screen) and equivalence (judge) are separate
    // criteria. eligibleEquivalent is a joint diagnostic, never the sole result.
    reasoningEligible: count(row => row.audit?.eligible),
    // Rows failing each eligibility category (a row can fail several), and the mean source-echo ratio.
    ineligibleBy: Object.fromEntries(ISSUE_CATEGORIES.map(c => [c, count(row => row.audit?.eligibility?.[c] === false)])),
    meanEchoRatio: rows.some(row => row.audit?.metrics) ? rows.reduce((a, row) => a + (row.audit?.metrics?.echoRatio ?? 0), 0) / rows.filter(row => row.audit?.metrics).length : null,
    longSymbols: rows.reduce((a, row) => a + (row.audit?.metrics?.longSymbols ?? 0), 0),
    judged: count(row => row.verdict?.status === 'judged'),
    equivalent: count(row => outcome(row) === 'equivalent'),
    notEquivalent: count(row => outcome(row) === 'not_equivalent'),
    uncertain: count(row => outcome(row) === 'uncertain'),
    equivalentWithNotes: count(row => outcome(row) === 'equivalent_with_notes'),
    eligibleEquivalent: count(row => row.audit?.eligible && outcome(row) === 'equivalent'),
    judgeErrors: count(row => row.verdict?.status === 'judge_error'),
    unanchoredDateRows: count(row => row.addedContent?.some(a => a.kind === 'unanchored-date')),
    behavioral: {
      casesWithProbes: count(row => (row.reference?.behavior?.length ?? 0) > 0),
      tested: tests.length,
      annotated,
      coverage: annotated ? tests.length / annotated : null,
      passed: tests.filter(probe => probe.pass).length,
      accuracy: tests.length ? tests.filter(probe => probe.pass).length / tests.length : null,
      accuracyAllAnnotated: annotated ? tests.filter(probe => probe.pass).length / annotated : null,
      semantic: summarizeProbes(tests.filter(probe => probe.kind === 'semantic')),
      controls: summarizeProbes(tests.filter(probe => probe.kind === 'control')),
      unsupportedCases: count(row => row.referenceEvaluation?.behavior?.status === 'unsupported'),
    },
  };
}

function summarizeProbes(probes) {
  return {tested: probes.length, passed: probes.filter(probe => probe.pass).length};
}

export function breakdown(rows, field) {
  const labels = new Set(rows.flatMap(row => field === 'tags' ? row.tags ?? [] : [row[field] ?? 'uncategorised']));
  return Object.fromEntries([...labels].sort().map(label => [
    label,
    summarizeRows(rows.filter(row => field === 'tags' ? row.tags?.includes(label) : (row[field] ?? 'uncategorised') === label)),
  ]));
}
