// Missing annotations are not perfect scores. Overlapping tags are reported
// independently and must never be summed as disjoint case counts.
export function summarizeRows(rows) {
  const count = predicate => rows.filter(predicate).length;
  const tests = rows.flatMap(row => row.referenceEvaluation?.behavior?.rows ?? []);
  const annotated = rows.reduce((sum,row)=>sum+(row.reference?.behavior?.length??0),0);
  return {
    n: rows.length,
    valid: count(row => row.ok),
    reasoningEligible: count(row => row.audit?.eligible),
    judged: count(row => row.verdict?.status === 'judged'),
    equivalent: count(row => row.verdict?.equivalent === true),
    eligibleEquivalent: count(row => row.audit?.eligible && row.verdict?.equivalent === true),
    judgeErrors: count(row => row.verdict?.status === 'judge_error'),
    behavioral: {
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
