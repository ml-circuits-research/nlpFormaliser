// Failure classes. Only `formalization` is semantic/syntactic evidence about a
// strategy. Budget and infrastructure failures are retried on resume and never
// counted as semantic failures.
// Patterns are anchored to transport/worker phrasing, not to bare words that a
// validation message could quote from the source vocabulary (e.g. "cancelled").
const BUDGET=/Model response was truncated|response (?:was )?cut off|finish_reason["':= ]+length|max_?tokens (?:limit )?(?:reached|exceeded)/i;
const INFRASTRUCTURE=/\bstatus \d{3}\b|\bHTTP \d{3}\b|\bunreachable\b|\bunavailable\b|no answer within|request timed out|timed out after|\bECONN[A-Z]+\b|\bETIMEDOUT\b|\bEAI_AGAIN\b|socket hang up|fetch failed|rate limit|Invalid batch response|Missing result for|Unexpected result ID|autostart failed|operation was aborted|Request cancelled/i;
const OFFLINE=/LLM disabled/;

export function classifyFailure(message) {
  const m=String(message??'');
  if(OFFLINE.test(m))return 'offline';
  if(BUDGET.test(m))return 'budget';
  if(INFRASTRUCTURE.test(m))return 'infrastructure';
  return 'formalization';
}

export const RETRYABLE_FAILURES=new Set(['infrastructure','budget']);

/** Re-derive the class of a saved row; legacy rows misfiled truncation/batch errors as formalization. */
export function rowFailure(row) {
  if(!row||row.ok)return null;
  const fromErrors=(row.errors??[]).map(classifyFailure);
  for(const c of ['offline','budget','infrastructure'])if(fromErrors.includes(c))return c;
  return row.failure??(fromErrors.length?'formalization':null);
}

export function isRetryableRow(row) {
  return RETRYABLE_FAILURES.has(rowFailure(row));
}
