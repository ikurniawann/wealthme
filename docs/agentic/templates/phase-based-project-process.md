# Generic phase-based project process template

Adapt this template to the user's actual goal, technology, acceptance criteria, and repository. Do not inherit product requirements, tools, libraries, deployment targets, or constraints from an example project unless the user asks for them. Existing project instructions and security rules take precedence.

## Project brief

- Goal and intended users:
- Existing stack and constraints (inspect before changing):
- In scope:
- Explicitly out of scope:
- Acceptance criteria:
- Verification and evidence:

## Phases

### 1. Discovery and planning

- Inspect existing project instructions and architecture before proposing changes.
- Resolve the goal, user flows, acceptance criteria, dependencies, and risks.
- Produce a small context capsule and a sequenced plan; ask only for decisions that cannot be inferred safely.
- Record decisions in the project's established docs location.

### 2. Design

- Reuse the existing design system and components where possible.
- Specify layouts, states, interactions, responsive behavior, and accessibility needs for the approved scope.
- Preserve the repo's design conventions; document proposals separately from accepted requirements.

### 3. Implementation

- Implement only the approved acceptance criteria in the existing app structure.
- Keep changes focused, reusable, and consistent with project conventions.
- Add or update tests and documentation with the behavior.

### 4. Integration and verification

- Exercise affected workflows and run the narrowest applicable project gates.
- Review the actual diff for scope, security, regressions, and user-owned changes.
- Report files changed, commands/results, limitations, and any remaining risks.

## Handoffs

For every phase, state its inputs, outputs, owner, and observable completion criteria. Keep durable decisions in the repository's tracked docs; do not depend on untracked agent memory. Treat specialist agents as optional host-specific helpers, not required infrastructure. Never claim a tool, agent, or command was run when it was not available.
