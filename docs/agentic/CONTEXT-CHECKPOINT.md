# Context checkpoint protocol

Use this when a task is long, context is getting full, or work is handed
between Claude Code and Codex.

1. Record only verified facts in `docs/agentic/checkpoints/<task>.md`.
2. Include the goal, acceptance criteria, files changed, commands and results,
   unresolved risks, rejected approaches, and the exact next command.
3. After compaction, read `MEMORY.md`, the checkpoint, and only the files named
   by the checkpoint. Do not reload the whole repository or old transcripts.
4. Review the checkpoint against the working tree before completion.
