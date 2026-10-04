"""Minimal LLM access layer.

Two backends:
  * Anthropic Python SDK  (used when ANTHROPIC_API_KEY is set)
  * `claude -p` headless CLI (fallback; works inside Claude Code sessions)
Every call is cached on disk (keyed by model+system+prompt) so experiments are
re-runnable without paying twice.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import threading
import time
from pathlib import Path

HAIKU = "claude-haiku-4-5"
SONNET = "claude-sonnet-5-5"

CACHE_DIR = Path(os.environ.get("NLPF_CACHE", Path(__file__).resolve().parent.parent / ".llm_cache"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)

_stats_lock = threading.Lock()
STATS = {"calls": 0, "cached": 0, "cost_usd": 0.0}


def _key(model: str, system: str, prompt: str) -> str:
    return hashlib.sha256(f"{model}\x00{system}\x00{prompt}".encode()).hexdigest()


def _call_sdk(model: str, system: str, prompt: str, max_tokens: int) -> tuple[str, float]:
    import anthropic

    client = anthropic.Anthropic()
    resp = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in resp.content if b.type == "text")
    return text, 0.0


def _call_cli(model: str, system: str, prompt: str, max_tokens: int) -> tuple[str, float]:
    cmd = ["claude", "-p", "--model", model, "--system-prompt", system,
           "--tools", "", "--output-format", "json"]
    last_err = ""
    for attempt in range(4):
        try:
            p = subprocess.run(cmd, input=prompt, capture_output=True, text=True,
                               timeout=300, cwd="/tmp")
            data = json.loads(p.stdout)
            if data.get("is_error"):
                raise RuntimeError(str(data.get("result"))[:300])
            return data["result"], float(data.get("total_cost_usd") or 0.0)
        except Exception as e:  # noqa: BLE001 - retry any CLI hiccup
            last_err = f"{e} | stderr={getattr(p, 'stderr', '')[:300] if 'p' in dir() else ''}"
            time.sleep(2 ** attempt)
    raise RuntimeError(f"claude CLI failed: {last_err}")


def complete(prompt: str, system: str = "", model: str = HAIKU, max_tokens: int = 4096,
             use_cache: bool = True) -> str:
    k = _key(model, system, prompt)
    f = CACHE_DIR / f"{k}.json"
    if use_cache and f.exists():
        with _stats_lock:
            STATS["cached"] += 1
        return json.loads(f.read_text())["text"]
    if os.environ.get("ANTHROPIC_API_KEY"):
        text, cost = _call_sdk(model, system, prompt, max_tokens)
    else:
        text, cost = _call_cli(model, system, prompt, max_tokens)
    f.write_text(json.dumps({"model": model, "text": text}))
    with _stats_lock:
        STATS["calls"] += 1
        STATS["cost_usd"] += cost
    return text


def extract_block(text: str, lang: str | None = None) -> str:
    """Return the content of the last fenced code block (or the raw text)."""
    pat = r"```(?:[a-zA-Z0-9_+-]*)\n(.*?)```"
    blocks = re.findall(pat, text, flags=re.S)
    return (blocks[-1] if blocks else text).strip()


def extract_json(text: str) -> dict:
    blk = extract_block(text)
    for cand in (blk, text):
        m = re.search(r"\{.*\}", cand, flags=re.S)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                continue
    raise ValueError(f"no JSON in: {text[:200]}")
