export class FormalizationStrategy {
  constructor(name) { this.name = name; }
  async formalize(_text, _context = {}) { throw new Error("formalize() not implemented"); }
}

export function assertStrategy(strategy) {
  if (!strategy || typeof strategy.formalize !== "function") throw new TypeError("Strategy must expose async formalize(text, context)");
  return strategy;
}
