---
date: 2026-09-27
epic: "Close and Distill a Merged Epic PR in One Command"
source: "#814"
---

# Lesson: a headless stage's exit status is not its outcome

Estimated M; shipped as one pull request carrying four releases (0.76.0–0.79.0). Stories #815 and #816 landed as planned. The scripted story (#817) needed a second pass after the first conformance run.

What cost the extra pass:

- **Exit status versus outcome.** The first script treated a zero exit from the headless analyze run as success. A headless `claude -p` or `codex exec` session exits 0 when the stage stops and explains why in words. Any script that chains Nexus stages must read each stage's outcome from the durable surface the stage writes (GitHub, git), never from the process. The decision record already applied this rule to close (D5) and distill (D9) but not to analyze; apply it to every stage a script starts.
- **Load ceilings shape structure.** The distill load ceiling had 13 bytes of headroom. That forced the unattended behaviour into its own contract file and trimmed prose elsewhere. A record that adds a mode to `/nxs.distill` should check the ceiling's headroom at design time and plan the contract split, instead of discovering it in the first draft.
- **Harness promises need a scheduled run.** Record #818 promised end-to-end codex runs (R2, R3). Conformance analysis cannot verify harness behaviour from a diff, so the promise was still open at close. Put such a run in a story's acceptance criteria, or schedule it before close, so it is not deferred by default.
