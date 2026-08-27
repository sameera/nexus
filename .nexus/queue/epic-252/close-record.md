---
title: "Close Record: Publish the release as one package carrying both toolkits, the component payload and the changelog"
epic: "#252"
feature: "Component Distribution"
date: 2026-08-27
nexus_version: 0.1.0
analyze: ran 2026-08-27 @ 5bd62646f054edd9d6dcc8012f4280297fc3602c
record: "#334"
record_hash: 6b617f3606bbf76ce938812925c2b8e61d0780baa54db9e2b16e1d95170cb380
range:
  - repo: github.com/sameera/nexus
    base: 7e803af6d0dba97f888d57c570ef835e86c526d7
    head: 6f6e8225a6b09a3cf7ee37e94df65f1b4b70eb41
---

# Close Record: Publish the release as one package carrying both toolkits, the component payload and the changelog

## Key Decisions

- **The epic landed across two PRs, and the range is stamped over their union, not over the branch fork point.** #333 carried the package definition and #337 the release-tail gate, on the same branch, with a `main` merge between them. The stamped range is `7e803af…6f6e822` — main-before-#333 to main-after-#337 — rather than the branch's own fork point `8bc4dff`, which would have swept epic #257's already-distilled retirement of the vendored tools directory into #252's attribution. Both anchors are merge commits on main, so the range still reproduces once the branch is deleted. *Refuted alternative:* stamp the fork point, matching what `/nxs.analyze` diffed (61 files); rejected because it double-attributes #257's work to this epic in the drain.

- **`nexus:release-gate` enforces invariant 15 as a runnable check, not as a line in the release procedure.** It scans the shipped component bodies for `.claude/…` paths the payload does not itself carry, and fails naming each one. It is step 4 of the release procedure, ahead of tag and publish, and it goes green by itself when epic #250 rewrites the invocations. *Refuted alternative:* a prose precondition in the procedure — cheaper, but it is precisely the release-day habit the executed-changelog decision had already rejected once.

- **The gate's rule is "the payload does not carry this path", not "no in-repo path appears".** A path the payload carries resolves wherever the components are deployed; a path it does not carry names a capability that has moved into a toolkit and is now reachable only by the toolkit's name. So `tsx ./.claude/skills/nxs-record-digest/scripts/record_digest.ts` passes and `python3 ./.claude/skills/nxs-gh-shared/delivery_config.py` fails. *Refuted alternative:* flag every in-repo path reference (71 hits) — a simpler regex that can never go green, because component-internal scripts work fine after deploy.

- **The changelog's coverage gap is accepted in writing rather than derived from the release diff.** Record #334's first ADDRESS risk offered both exits. The suite checks the entry's *language*, not its *coverage*; the release procedure now says so and hands the author `git diff --name-only <previous tag>..HEAD -- .claude`. *Refuted alternative:* derive `touchedComponentBody` / `changedStageBehaviour` from the release diff and fail when the entry does not account for them — stronger, but it needs a tag history the project does not have yet, and it would fail on a shallow or tagless checkout for a fact a human still has to judge.

- **The declared Python floor is 3.10, and the declaration is the whole of the answer for this release.** 3.10 is the lowest interpreter the toolkit actually runs on: `create_epic.py` annotates a module-level assignment `str | None`, which 3.9 evaluates at import and rejects. It is declared in `engines.python` beside the Node floor and in the readme's Requirements section, with `os: ["darwin", "linux"]`. Record #334's second ADDRESS risk offered a first-run prerequisite check instead; the declared floor was taken. *Refuted alternative:* declare 3.12 (the development machine's version), which states a support boundary no code requires.

- **Reconciling with epic #257: the pin step keeps the payload abstraction and loses its copy half.** #257 retired the vendored tools directory along with the pin step's `--tools-dir` copy; #252 redefined what ships. Only the destination conflicted, and the release tree is now the one destination — so `vendorBundles` builds, hashes the stated payload, writes the pin and its diagnostic manifest, and `runCli` rejects every argument by name. Staging into the release tree stays with `pack-release.ts`. *Refuted alternative:* keep `--tools-dir` for a non-hub destination — it restores a second staging path and reopens the "two artifacts ageing independently" cost #257 paid to remove.

- **The pin script keeps main's name (`nexus:pin-bundles`) and the branch's callers follow it.** The step no longer vendors anything, so the merged name is the accurate one, and a release procedure naming a script that does not exist fails on release day. *Refuted alternative:* restore `nexus:vendor-tools`, an alias whose verb the code has stopped doing.

- **The direct-run guard was swept into the three repository-only build scripts.** `build-bundles.ts`, `pack-release.ts` and `vendor-bundle.ts` still compared `import.meta.url` against a constructed `file://` string; they now use `isDirectRun()`, which resolves both sides through `realpath`. None ships in the payload, so this fixes nothing an adopter can reach — but it removes the second answer the codebase carried to the same question, which is the pattern the next entry point would have been copied from. *Refuted alternative:* leave them, since they are correct today.

- **Story #312's AC1 was amended in place on the issue rather than left unmet.** The original AC required a release to have actually been cut. The amendment records the original text verbatim, names invariant 15 as the reason it cannot hold inside this epic, and rescopes AC1 to the identity check (`checkReleaseIdentity`) that the story did build and can prove. *Refuted alternative:* hold #252 open until #250 lands and cut the release under it — it keeps AC1 verbatim, but blocks a finished epic on an unstarted one and parks four closed stories behind it.

## Deviation Rationale

- **The release tail was not cut; the epic closes with the package defined but unpublished (deviates from epic #252's Success Metric 1, "installable from the public registry"; conforms to record #334 invariant 15).** Record #334 forbids the tag and the public publish while any shipped component body reaches a toolkit capability by an in-repository path. `pnpm nexus:release-gate` is red on twelve such references, all in `commands/nxs.epic.md`, `commands/nxs.setup.md` and `skills/nxs-epic-resolve/SKILL.md` — the condition epic #250 removes. Publishing anyway would put bodies on the registry that cannot work outside a source checkout, and the changelog's own claim that a stage runs without a checkout would be false on the first release. Holding the epic open instead would block a finished epic on an unstarted one and leave four closed stories parked behind it, so the tail was re-filed as backlog stub #336 (blocked by #250) and #312's AC1 rescoped to what shipped. The package definition itself is complete and consumable now by packing and installing locally, which is the layout epics #253 and #256 depend on.

- **Invariant 15 acquired an executable gate that record #334 did not specify (deviates from record #334, which stated invariant 15 as a constraint and left its enforcement unstated).** The conformance analysis found that a releaser following the written procedure walks straight from re-pin to publish with nothing between them but prose. A runnable check that names the offending lines stops them where prose would not, and — unlike a procedural note — it goes green on its own when #250 lands, so nobody has to remember to delete it. The gate adds a step to the release procedure and a script to the manifest; it changes no decision the record made.

## Deferred Scope

Deferred items filed as backlog stub issues:

- #336 — Cut the first release: tag, publish and the releases-page entry (blocked by #250)

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-08-27-publish-one-package.md`
