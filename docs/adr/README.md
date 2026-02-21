# ADRs (Architecture Decision Records)

This folder stores architecture decisions that affect system structure, security, scalability, or operational behavior.

## When to add an ADR

Create an ADR when a change does at least one of these:

- Adds or changes API contracts.
- Changes database schema, RLS, or trust boundaries.
- Introduces or removes a core dependency/framework.
- Changes critical user flow behavior (auth, completion, offline sync, social).
- Changes deployment/runtime topology.

## Naming convention

- Use zero-padded numeric prefix.
- Format: `NNNN-short-kebab-title.md`.
- Example: `0001-bangalore-first-city-gate.md`.

## Lifecycle

- Start with `Status: Proposed`.
- Move to `Accepted` when implemented.
- Use `Superseded` when replaced by a newer ADR.

## Template

- Copy from: `/Users/atulkrishnan/Documents/Passport Quest/docs/adr/0000-template.md`

## Current ADRs

- `0001-bangalore-first-expansion-gate.md` (Superseded by ADR 0002)
- `0002-india-first-rollout-delhi-pune.md` (Accepted)
