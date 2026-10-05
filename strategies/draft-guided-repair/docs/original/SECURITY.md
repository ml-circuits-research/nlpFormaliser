# Safety and execution model

The library intentionally does **not** execute code emitted by an LLM.

An LLM returns constrained JSON Formal IR. `compileFormalModule()` then serializes that data into a deterministic `.mjs` program containing only the IR and the trusted CNL renderer. This avoids turning arbitrary model output into executable JavaScript.

`externals` are declarations only. The bundled reasoner and generated formal module do not dynamically import or execute external implementations. If a future runtime binds external predicates to code, use an explicit allowlist/capability model and validate argument types.

The CNL round-trip renderer is deterministic and never calls an LLM; otherwise a second generative model could silently repair a bad formal representation before judging.
