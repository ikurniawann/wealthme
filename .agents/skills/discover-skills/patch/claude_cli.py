# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Claude Code CLI backend for the LLM pass.

Lets the LLM analysis run on the local ``claude`` CLI (your Claude Code
session) instead of a paid API key. Enable with ``SKILLSPECTOR_USE_CLAUDE_CLI=1``.

The objects here are duck-typed to match the small surface the analyzers use
from a LangChain chat model: ``invoke`` / ``ainvoke`` returning an object with
a ``.content`` string, and ``with_structured_output(schema)`` returning an
object whose ``invoke`` / ``ainvoke`` return a validated Pydantic instance.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import subprocess

from pydantic import BaseModel

from skillspector.logging_config import get_logger

logger = get_logger(__name__)

_CLAUDE_BIN = os.environ.get("SKILLSPECTOR_CLAUDE_BIN", "claude")
_TIMEOUT = int(os.environ.get("SKILLSPECTOR_CLAUDE_TIMEOUT", "300"))


def use_claude_cli() -> bool:
    """True when the Claude Code CLI backend is enabled via env."""
    return os.environ.get("SKILLSPECTOR_USE_CLAUDE_CLI", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def _cli_args() -> list[str]:
    args = [_CLAUDE_BIN, "-p", "--output-format", "json", "--max-turns", "1"]
    model = os.environ.get("SKILLSPECTOR_MODEL", "").strip()
    if model:
        args += ["--model", model]
    return args


def _extract_result(stdout: str) -> str:
    """Pull the assistant text out of the ``claude --output-format json`` envelope."""
    data = json.loads(stdout)
    if data.get("is_error"):
        raise RuntimeError(f"claude CLI returned an error result: {data.get('result', '')[:300]}")
    return data.get("result", "") or ""


def _run_sync(prompt: str) -> str:
    proc = subprocess.run(
        _cli_args(),
        input=prompt,
        capture_output=True,
        text=True,
        timeout=_TIMEOUT,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"claude CLI failed (exit {proc.returncode}): {proc.stderr[:500]}")
    return _extract_result(proc.stdout)


async def _run_async(prompt: str) -> str:
    proc = await asyncio.create_subprocess_exec(
        *_cli_args(),
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out, err = await asyncio.wait_for(proc.communicate(prompt.encode()), timeout=_TIMEOUT)
    if proc.returncode != 0:
        raise RuntimeError(
            f"claude CLI failed (exit {proc.returncode}): {err.decode(errors='replace')[:500]}"
        )
    return _extract_result(out.decode(errors="replace"))


# ---------------------------------------------------------------------------
# JSON extraction for structured output
# ---------------------------------------------------------------------------

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def _extract_json(text: str) -> str:
    """Isolate the first complete JSON object from the model's reply.

    Strips a code fence if present, then brace-balances from the first ``{``
    while respecting string literals, so braces/quotes inside ``code_snippet``
    fields or surrounding prose don't truncate or over-capture the object.
    """
    text = text.strip()
    fence = _FENCE_RE.search(text)
    if fence:
        text = fence.group(1).strip()

    start = text.find("{")
    if start == -1:
        return text

    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        c = text[i]
        if esc:
            esc = False
            continue
        if c == "\\":
            esc = True
            continue
        if c == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    # Unbalanced (e.g. truncated reply) — return the remainder and let _parse
    # degrade gracefully rather than guess.
    return text[start:]


# ---------------------------------------------------------------------------
# Duck-typed model surface
# ---------------------------------------------------------------------------


class _Message:
    """Mimics a LangChain message: exposes ``.content``."""

    def __init__(self, content: str) -> None:
        self.content = content


class _StructuredClaude:
    """Returns a validated Pydantic instance from a ``claude -p`` reply."""

    def __init__(self, schema: type[BaseModel]) -> None:
        self._schema = schema

    def _prompt(self, prompt: str) -> str:
        schema_json = json.dumps(self._schema.model_json_schema())
        return (
            f"{prompt}\n\n"
            "## Response format (strict)\n"
            "Respond with ONLY a single JSON object that validates against this "
            "JSON Schema. No prose, no explanation, no markdown code fences.\n"
            f"{schema_json}"
        )

    def _parse(self, raw: str) -> BaseModel:
        candidate = _extract_json(raw)
        try:
            return self._schema.model_validate_json(candidate)
        except Exception:
            pass
        try:
            return self._schema.model_validate(json.loads(candidate))
        except Exception as exc:
            # Never let a parse failure escape: json.JSONDecodeError is a
            # ValueError subclass, and the analyzers treat ValueError as a
            # fatal "no credentials" signal — which would kill the whole scan.
            # Degrade to an empty result for this batch instead.
            logger.warning(
                "claude_cli: could not parse structured reply (%s); "
                "returning empty result for this batch",
                exc,
            )
            return self._schema()

    def invoke(self, prompt: str) -> BaseModel:
        return self._parse(_run_sync(self._prompt(prompt)))

    async def ainvoke(self, prompt: str) -> BaseModel:
        return self._parse(await _run_async(self._prompt(prompt)))


class ClaudeCLIModel:
    """Minimal stand-in for ``ChatOpenAI`` backed by the ``claude`` CLI."""

    def invoke(self, prompt: str) -> _Message:
        return _Message(_run_sync(prompt))

    async def ainvoke(self, prompt: str) -> _Message:
        return _Message(await _run_async(prompt))

    def with_structured_output(self, schema: type[BaseModel]) -> _StructuredClaude:
        return _StructuredClaude(schema)
