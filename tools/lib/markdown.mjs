// Markdown table header with exactly one delimiter cell per column.
export const STRATEGY_HEADER=['Run','Stage','Strategy','N','Valid','Eligible','Judge equivalent','Eligible + equivalent','Budget/infrastructure failures','Judge errors'];
export function tableHeader(columns,numericFrom=3,numericTo=columns.length) {
  return `| ${columns.join(' | ')} |\n|${columns.map((_,i)=>i>=numericFrom&&i<numericTo?'---:':'---').join('|')}|`;
}
