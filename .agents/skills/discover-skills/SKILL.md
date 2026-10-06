---
name: discover-skills
description: Safely add an agent skill — scan it for security vulnerabilities and malicious code first, fix the safe-to-fix issues, and only install it if it's clean. Use when the user wants to add, install, vet, scan, audit, or security-check a skill (e.g. from skills.sh or a GitHub repo) before adding it, asks whether a skill is safe to install, or wants to clean, fix, or purify a flagged skill. Works on a skills.sh package (owner/repo), a GitHub URL, or a local skill folder. Do NOT use for general code review or scanning non-skill repositories.
---

# Discover Skills — safely scan, fix, and add agent skills

Never let a skill into the agent unchecked. You scan it with NVIDIA's
SkillSpector, fix what's safe to fix, and only then install it. The scanner is
the judge that tells you what's wrong and whether you've actually fixed it; you
run the loop and make the install/reject call.

## When to use

- "Add / install this skill" (from skills.sh or a repo) → scan it first, then install.
- "Is this skill safe to install?" → scan and report.
- "Clean up / fix / purify this skill." → scan, fix, re-scan.

## Step 1 — Identify the target and get a local copy

You can only inspect and fix files you can read, so work on a local copy.

- skills.sh package `owner/repo`, or a GitHub URL → clone it:
  `git clone https://github.com/owner/repo /tmp/skill-review`
- A local folder → use it directly.

## Step 2 — Scan

Run the helper (it sets itself up on first run — clones + patches + builds the
scanner inside this skill):

```bash
# Claude Code
.claude/skills/discover-skills/scripts/scan.sh <skill-path> /tmp/scan.json

# Codex CLI (static scan; its optional Claude-backed LLM pass is unavailable)
.agents/skills/discover-skills/scripts/scan.sh <skill-path> /tmp/scan.json
```

The helper bootstraps SkillSpector from GitHub on first use and rebuilds a local virtual
environment; ask before running it. Default is fast static-only. For the deeper Claude LLM
pass on Claude Code only, prefix `SKILLSPECTOR_LLM=1`:

```bash
SKILLSPECTOR_LLM=1 .claude/skills/discover-skills/scripts/scan.sh <skill-path> /tmp/scan.json
```

Read `/tmp/scan.json`:

- `risk_assessment.score` (0–100) and `risk_assessment.recommendation`
  (SAFE / CAUTION / DO_NOT_INSTALL)
- `issues[]` — each has `id`, `severity`, `location.file`, `location.start_line`,
  `explanation` (why it's dangerous), and `remediation` (how to fix it)

## Step 3 — Triage each finding

Sort every issue into one of two buckets. This decision is yours — read each
finding's explanation, don't auto-fix blindly.

- **Malicious intent → do not silently fix, lean toward rejecting.** If the
  explanation describes deliberate harm — stealing credentials / API keys,
  sending data to an external server, a reverse shell or other malware, a
  backdoor, a lookalike (homoglyph) name, or a hidden instruction injected into
  the metadata — the right move is usually _don't install it_. Report these
  clearly and ask before stripping anything.
- **Vulnerability / bad hygiene → fix it.** Config and safety issues with no
  malicious intent — `shell=True`, `verify=False`, unpinned dependency versions,
  missing user warnings, overly broad triggers, over-declared permissions. Apply
  the finding's `remediation` directly.

## Step 4 — Fix (when fixing)

For each finding in the fix bucket: open `location.file` at `location.start_line`,
apply the `remediation`, keep the skill's real functionality intact. Make the
smallest change that removes the issue — don't gut the skill.

## Step 5 — Re-scan and loop

Run Step 2 again on the same path. Compare:

- Score dropped and the fixed findings are gone → good.
- New or remaining findings → fix those and re-scan.

Repeat until no HIGH/CRITICAL remain, or you've looped **3 times** — then stop
and report what's left rather than looping forever. Use the re-scan score as the
hard signal that you're done, not your own sense that it "looks fixed."

## Step 6 — Install (only if clean)

Once it passes (SAFE, or CAUTION the user accepts), install it with the
skills.sh CLI:

```bash
pnpm dlx skills add owner/repo          # -g for global, -y to skip prompts
```

If the skill came from a URL/repo and you fixed it locally, the marketplace copy
is still the original — so either install the marketplace version only when it
scanned clean as-is, or keep your fixed local copy in `.claude/skills/` instead
of re-pulling it. Never run `skills add` on something you flagged as malicious.

## Step 7 — Report

Give a short before/after:

- starting score + recommendation → final score + recommendation
- what you fixed (one line each)
- anything you flagged as malicious and did **not** touch, and why
- the verdict: installed it, or rejected it and why
