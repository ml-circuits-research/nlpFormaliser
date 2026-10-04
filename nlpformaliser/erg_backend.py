"""DELPH-IN English Resource Grammar (ERG) round trip:  text --ACE parse--> MRS --ACE generate--> text.

Fully symbolic and bidirectional (the same grammar parses and generates). Needs the ACE binary
(https://sweaglesw.org/linguistics/ace/) and a compiled ERG image, e.g.
  https://github.com/delph-in/erg/releases/download/2025/erg-2025-x86-64-0.9.34.dat.bz2

NOTE: in the sandbox used for the reported experiment, sweaglesw.org was blocked by the network
policy, so ACE could not be installed and this back-end was NOT run. Set ACE_BIN / ERG_DAT and run
    python experiments/run.py --backends erg
to include it.
"""
from __future__ import annotations

import os

from .backends import Backend
from .llm import complete, extract_block

ACE_BIN = os.environ.get("ACE_BIN", "ace")
ERG_DAT = os.environ.get("ERG_DAT", "/opt/dl/erg-2025.dat")


class ERGBackend(Backend):
    """ERG parse -> MRS (the formal code) -> ERG generation. The LLM is used only as a repair step:
    it edits the SimpleMRS when the round trip is judged non-equivalent."""
    name = "erg"
    lang = "mrs"
    system = ("You edit Minimal Recursion Semantics (MRS, SimpleMRS serialisation, ERG predicate names) so "
              "that it expresses exactly the meaning of the original text. Output only one ```mrs block.")

    def formalize(self, text):
        from delphin import ace
        from delphin.codecs import simplemrs
        resp = ace.parse(ERG_DAT, text, executable=ACE_BIN, cmdargs=["-1"])
        if not resp.results():
            return f"; no ERG parse for: {text}"
        return simplemrs.encode(resp.result(0).mrs(), indent=True)

    def check(self, code):
        from delphin.codecs import simplemrs
        if code.startswith("; no ERG parse"):
            return ["ERG found no parse (coverage gap)"]
        try:
            simplemrs.decode(code)
        except Exception as e:  # noqa: BLE001
            return [f"SimpleMRS decode error: {e}"]
        return []

    def realize(self, code):
        from delphin import ace
        resp = ace.generate(ERG_DAT, code, executable=ACE_BIN, cmdargs=["-n", "1"])
        if not resp.results():
            raise RuntimeError("ERG could not generate from this MRS")
        return resp.result(0)["surface"]

    def refine(self, text, code, errors, realization, differences):
        if code.startswith("; no ERG parse"):
            return code  # nothing to repair symbolically
        return super().refine(text, code, errors, realization, differences)


def register():
    from .backends import BACKENDS
    BACKENDS[ERGBackend.name] = ERGBackend
