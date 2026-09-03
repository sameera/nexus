---
title: "Prose Verification"
aliases: ["preservation check", "region comparison", "fail-closed translation check", "tracked token classes", "pre-translation copy", "bounded retranslation", "grounding enforcement"]
touches: ["prose-translation", "verb-reachability", "distiller"]
last_updated_by: "#414"
status: active
verification: verified
---

# Prose Verification

A translated artifact is proven faithful by comparing the pre- and post-translation copies, never by asking a person to read it. One invocation returns one verdict over two properties: every machine-read region is byte-identical, and every tracked carrier of fact survives. It fails closed, and a failure earns one retranslation before the run stops.

## How It Works

The invoking stage keeps a copy immediately before the translator runs, so exactly one writer sits between the two copies. The region property holds frontmatter, fenced blocks, comment blocks and acceptance-criteria lines to byte identity. The preservation property reads the prose that regions do not claim, over four classes that carry fact: numbers, modal verbs, name-shaped tokens, and structure.

Each class is drawn against the rewrites the form rules permit, so a legal rewrite is invisible to it. A number is keyed by what it denotes, with its suffix attached. Zero and one sit outside the class in every written form, because English uses those words as article and pronoun as readily as counts. Structure is counted by shape and never sequenced, so splitting an over-long bullet passes. Names are matched by shape, plus a proper-noun tier drawn from both copies and counted at every position. An introduced item fails, except on a distillation run where a named grounding source carries it.

## Key Invariants

1. Both properties are reached through one invocation returning one verdict, so no run satisfies one and skips the other.
2. The check fails closed: a lost item, a reduced count, an unpermitted introduction, or an unreadable copy exits non-zero.
3. The preservation classes are read over the prose alone; the regions are held to the stricter byte-identity rule in the same verdict.
4. Zero and one sit outside the tracked numeric class in every written form, and structure is keyed by shape, never by order or nesting.
5. A failure earns one restoration and one further translation; a second failure stops the run, and nothing is filed or written out.
6. The pre-translation copy's life ends at the verdict — deleted on a pass, kept only for diagnosis, never committed.
7. Where a form rule cannot run without tripping a class, the rule is amended rather than the class exempted.

## Integration Points

- [prose-translation](prose-translation.md) — the writes this check bounds, and the rule set co-designed against its classes.
- [verb-reachability](verb-reachability.md) — a shipped component body invokes this check by name, so it ships as a declared verb over a library.
- [distiller](distiller.md) — names its grounding sources to the check, so an introduced token is permitted only where a source carries it.

## Decision Log

### 2026-09-02 — #414 — Fidelity is proven by a token comparison, not by a reader

The superseded design paid for fidelity with review time: the author re-read every changed section, and a distillation reviewer was asked to compare each page against a copy the convention had already deleted. Spotting a lost number needs no judgment, while grounding an abstraction needs all of it, so the machine took the first and the human kept the second. Refuted alternative: have a second model read the translation for fidelity, which reaches meaning no token class does and spends no human attention — it lost because a stochastic reader checking a stochastic writer produces a verdict nobody can check, and the returned prose is exactly the cost the split exists to avoid.
