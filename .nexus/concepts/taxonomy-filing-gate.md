---
title: "Taxonomy Filing Gate"
aliases: ["domain filing gate", "three-way taxonomy gate", "forced-fit filing", "best-fit domain filing"]
touches: ["distiller", "distillation-pr", "domain-taxonomy", "drift-advisory", "registry-seeding"]
last_updated_by: "#94"
status: active
verification: verified
---

# Taxonomy Filing Gate

When the drain creates a concept and a domain registry exists, it files the concept under a best-fit domain by matching it against the registry's rubrics. A clear fit files silently; when no rubric truly fits, the filing is forced and a three-way gate stops the drain so a reviewer chooses. Any domain or subdomain they approve is authored into the registry on the same distillation-PR as the page that motivated it.

## How It Works

Filing is a synthesis judgment, not a link-affinity classifier — a just-born concept has no stable link history, so the model matches its summary against the rubrics as a closed list. The drain always writes a resolving best-fit for every created page, so the validator that rejects an unresolved filing stays strict; a clear-or-forced flag decides whether a gate is needed. A forced fit — no rubric's scope covers the concept, or covering it would stretch a rubric past its boundary — halts the drain and offers three choices: confirm the best-fit, coin a subdomain under an existing domain, or coin a new domain. Ties resolve to forced, so nothing is filed silently against the reviewer's judgment. Growth is graded: refining a domain is lighter than coining a top-level one.

## Key Invariants

1. Filing runs only when a registry exists; with none it is inert and no gate fires.
2. Every created page gets a resolving, already-defined best-fit domain before validation — never unfiled, never an invented path.
3. Only a create files a domain; an update or retire never adds or changes a page's filing.
4. A clear fit files silently; a forced fit — the resolution whenever the match is genuinely unsure — blocks the drain until the reviewer chooses.
5. The gate offers exactly three graded options: confirm best-fit, new subdomain, or new domain.
6. An approved domain or subdomain is authored on the same distillation-PR as its motivating page.

## Integration Points

- [distiller](distiller.md) — the drain that files during synthesis and raises the gate at its checkpoint.
- [distillation-pr](distillation-pr.md) — the reviewed write an approved registry change rides, beside its motivating page.
- [domain-taxonomy](domain-taxonomy.md) — the registry whose rubrics filing matches against and whose vocabulary the gate grows.
- [drift-advisory](drift-advisory.md) — the later audit of the filings this gate produces.
- [registry-seeding](registry-seeding.md) — bootstraps a first registry that this gate then maintains.

## Decision Log

### 2026-07-20 — #94 — Filing is a synthesis judgment; the gate is confirm/override for forced fits only

The drain files a new concept by matching it against the registry's rubrics during synthesis, mirroring slug convergence, rather than by a deterministic link-affinity classifier — a just-born concept has no stable link history and rubrics are prose, not machine-checkable predicates. Synthesis always writes a resolving best-fit so the strict validator needs no pending-filing state, and a clear-or-forced flag drives whether the three-way gate fires; ties resolve to forced so nothing is filed silently against the reviewer. Refuted alternative: leave the concept unfiled and relax the validator to tolerate a pending state until the checkpoint — viable, but it fragments the validator's clean, byte-parity-gated contract with a sentinel state.
