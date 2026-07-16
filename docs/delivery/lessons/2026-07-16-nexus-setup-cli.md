---
date: 2026-07-16
epic: "Nexus Setup CLI"
source: "#60"
---

# Lesson: A bare-runtime target surfaces packaging defects the in-repo path hides

The epic estimated M and landed at M — five stories behind one shared entrypoint, the deploy
primitive reused cleanly by `init` and `add-repo` as planned, no re-decomposition. Estimation was
sound. The delivery lesson is about *where* the surprise came from.

The one real deviation was not in the CLI's logic — every workspace verb, the resolver-parity loop,
and the two-file `add-repo` mutation shipped as the decision record drew them. It was in **packaging**:
the moment a bundle that inlines a CommonJS dependency (`yaml`) actually ran on a bare Node runtime,
it crashed on `Dynamic require`. That defect was already latent in a previously-shipped tool
(`derive-entry-diff.mjs`); nothing exercised it until this epic's "runs with no in-repo tooling"
requirement forced a genuine bare-runtime execution.

For the next epic in this area: when a story's acceptance criterion is "runs on a bare runtime with no
install step," treat the *packaging path itself* — not just the feature logic — as first-class scope
to test end-to-end early. The in-repo test harness has Node's full module resolution available and
will pass while the shipped bundle fails. Budget a plain-node execution of the actual distributable
into the first story that claims bare-runtime portability, rather than discovering the interop gap
when the last verb trips it.
