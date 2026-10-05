import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {atom, compileFormalModule, makeIR, renderCNL} from "../src/index.mjs";

const exec = promisify(execFile);

test("compiled formal .mjs executes and prints the same CNL", async () => {
  const ir = makeIR({facts:[atom("owns", "alice", "gpu1")]});
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "formalizer-"));
  const file = path.join(dir, "formal.mjs");
  await fs.writeFile(file, compileFormalModule(ir));
  const {stdout} = await exec(process.execPath, [file]);
  assert.equal(stdout.trim(), renderCNL(ir).trim());
});
