# Plan — Story 1: The resolver rebuilds an epic from its issue number

Epic: Issue-Sourced Planning (#114) · Story: STORY-114.01 · Issue: #115 · Size: M
Executor target: implement a new nx lib `@nexus/epic-resolve` + a thin CLI skill `nxs-epic-resolve`.

---

## 1. Goal

Ship a deterministic, fail-closed **resolver** that takes an epic issue number and reconstructs a
single materialized `epic.md` from the live GitHub issue graph (epic body + story sub-issues +
native `blocked_by` graph). It is shared substrate only — it changes no existing command.

"Done" = Story 1's four ACs pass:

1. **AC1 (all-or-nothing).** Given an epic issue with N story sub-issues, one resolver run emits one
   `epic.md` containing the epic body and all N stories. If ANY referenced sub-issue cannot be
   fetched, the run exits non-zero and writes **no** `epic.md` (no partial/silent output).
2. **AC2 (idempotent).** Two runs against an unchanged issue graph produce **byte-identical** output.
3. **AC3 (ephemeral).** The output path is outside version control (gitignored / session scratch);
   `git status` reports no new tracked file after a run.
4. **AC4 (faithful deps).** The materialized `## Implementation Sequence` `blocked_by` column
   reproduces the native GitHub dependencies exactly — every edge present, none invented.

---

## 2. Judgment calls already made — do not re-decide

From the decision record (BINDING) and epic Notes. Treat these as instructions:

- **One producer.** There is exactly ONE resolver. Do not scatter fetch/reconstruct logic; every
  future stage calls this one path. (Decision record: "single deterministic, idempotent, fail-closed
  resolver is the only producer".)
- **Fail-closed.** Any unfetchable referenced sub-issue is a hard non-zero exit with NO output
  written. Never emit a truncated epic. (Invariant 2.)
- **Byte-identical.** Requires a canonical story ordering **independent of GitHub's return order**,
  stable serialization, and **no volatile fields** (no timestamps, run IDs, `createdAt`, `updatedAt`)
  in the output. (Invariant 3.)
- **Ephemeral output.** Outside version control. A run leaves the tree with no new tracked file.
  (Invariant 4, AC3.)
- **Reuse the field shape** the pipeline writes today so downstream parsers are unchanged — to the
  extent the issue graph carries it (see the CONFLICT in §3; do not fabricate fields that are not
  recoverable). (Invariant 5 + the reported conflict.)
- **Live deps are the source of truth for the sequence.** Build `## Implementation Sequence` from the
  live native `blocked_by` edges, NOT from any (possibly stale) table baked into the epic issue body.
  (AC4, invariant 5.)
- **Read-only.** The resolver fetches; it never mutates GitHub or any checkout. (Invariant 6.)
- **Targeting.** In a workspace, target the **hub repo's** issues via the existing workspace resolver
  (#38, `@nexus/workspace` `resolveWorkspace`); in single-repo, target the local repo. Role comes
  from the committed workspace artifacts, never a new heuristic. (Invariant 7, Story 1 Notes.)
- **The epic issue number is the sole join key.** No dependency on a branch name or a committed queue
  path. (Invariant 1.)

---

## 3. Ground truth (verified — read these files; do not re-search)

### CONFLICT to report (decision record vs. repo reality) — read before planning fidelity

The decision record's "reuse the existing field shape … same frontmatter, user-stories, and
implementation-sequence shape … so no downstream parser changes" is only **partially achievable**
from the issue graph *as it is filed today*, because the filing skills discard fields the `epic.md`
shape carries:

- `.claude/skills/nxs-gh-create-epic/scripts/nxs_gh_create_epic.py`
  - `parse_frontmatter` + body handling: **all frontmatter is stripped** before the issue is created.
    `strip_story_bodies` (lines ~198–228) also **removes the entire `## User Stories` section**.
  - Result: the epic issue body starts at `# Epic: <title>` and contains Description, Success Metrics,
    Personas, Assumptions, Out of Scope, Open Questions, and (if present at filing) a **frozen**
    `## Implementation Sequence`. It does **not** carry `feature`, `feature_path`, `slug`, `created`,
    `complexity`, `complexity_drivers`, or `concepts`. Only the **title** (→ issue title), **`type`**
    (→ GitHub issue type), and **`link`** (= the issue number itself) survive.
- `.claude/skills/nxs-gh-create-story/scripts/create_gh_issues.py`
  - Files each story with a **clean title** (no `Story N:` / no `STORY-…` prefix — `ref` is explicitly
    "not surfaced on the issue", lines ~53, ~786) and a body of just the As-a / `## Acceptance
    Criteria` / `## Notes` text. The epic's per-story **`- **story_type:**`** and **`- **size:**`**
    bullets are NOT in the filed story body (`/nxs.epic` Phase 6 step 3 template,
    `.claude/commands/nxs.epic.md` lines ~381–398).

**Consequence:** the resolver cannot faithfully reproduce (a) epic frontmatter beyond
`epic`/`type`/`link`, (b) the per-story `story_type`/`size` bullets, or (c) the original
`STORY-<epic>.<seq>` refs, purely from GitHub. It must synthesize what is deterministic (refs by
canonical order) and omit what is not (the missing frontmatter fields) — never fabricate.

This does **not** block Story 1's four ACs (none of them require frontmatter or `story_type`/`size`
fidelity). Plan the resolver to satisfy the ACs and reconstruct what is recoverable. **Do not plan
around the conflict by inventing values.** The "same field shape / no downstream parser changes"
claim is load-bearing for Stories 4 (#116) and 5 (#117), which read `story_type` / success metrics;
its resolution (either the filing skills must persist the missing fields, or downstream must tolerate
their absence) belongs to those stories, and is flagged here.

### How the epic is filed today (the shape to read back)

- Epic issue body = `# Epic: <title>` onward, minus `## User Stories`. (per above script.)
- Story sub-issues = children of the epic via `addSubIssue` GraphQL mutation
  (`create_gh_issues.py` `assign_parent_issue`, lines ~560–605).
- `blocked_by` = native GitHub dependencies wired via REST
  `POST repos/{owner}/{repo}/issues/{n}/dependencies/blocked_by` with `issue_id=<blocker db id>`
  (`create_gh_issues.py` `add_blocked_by`, lines ~649–664). There is no GraphQL mutation for it.

### How to read the graph back via `gh` (the resolver's fetches)

- **Sub-issues of an epic** — GraphQL, proven in `.claude/commands/nxs.close.md` lines ~132–140:
  ```
  gh api graphql -f query='
    query($owner:String!,$repo:String!,$num:Int!){
      repository(owner:$owner,name:$repo){
        issue(number:$num){ subIssues(first:100){ nodes{ number title state } } }
      }
    }' -F owner=<owner> -F repo=<repo> -F num=<epic-issue>
    --jq '.data.repository.issue.subIssues.nodes[] | .number'
  ```
  Fetch the ordered sub-issue numbers, then fetch each story fully (see next) so a per-issue fetch
  failure is detectable (AC1 fail-closed).
- **Epic body + title + type** — `gh issue view <n> --json title,body` (+ issue type via a GraphQL
  `issueType{ name }` query if you choose to emit `type`; omit rather than fabricate if unavailable).
- **Each story body** — `gh issue view <subNum> --json number,title,body,state`.
- **A story's native blocked_by** — REST: `gh api repos/{owner}/{repo}/issues/<subNum>/dependencies/blocked_by --jq '.[].number'`
  returns the **blocker issue numbers** (the endpoint returns full issue objects; take `.number`).
  Reference: `create_gh_issues.py` `get_blocked_by_db_ids` (lines ~634–646) reads `.[].id` from the
  same path — the resolver reads `.number` instead so it can map to synthesized story refs.
- `gh` targets the current repo from its process `cwd`; `{owner}`/`{repo}` in `gh api` paths are
  filled from that repo. So the resolver runs every `gh` call with `cwd` = the resolved target root.

### Workspace targeting (#38)

- `libs/workspace/src/resolve.ts` — `resolveWorkspace(startDir): ResolveResult`. On `ok`, the
  workspace is either `{ mode: "single-repo", root }` or `{ mode: "workspace", hubRoot, … }`.
  Target root = `hubRoot` for a workspace, `root` for single-repo. Import from `@nexus/workspace`
  (package export; used exactly this way by `@nexus/pr-worktree`).

### The lib + skill pattern to copy (closest analog: `@nexus/pr-worktree`)

- Runner seam: `libs/close-migration/src/run.ts` — `type Runner = (cmd, args, {cwd}) => RunResult`
  (`{status,stdout,stderr}`), `defaultRunner` (spawnSync), `git()` helper. `@nexus/pr-worktree`
  re-exports it via `libs/pr-worktree/src/run.ts` (`export { … } from "@nexus/close-migration/run"`).
  Do the same in the new lib. Specs inject a Runner returning canned `gh` JSON — no network.
- Diagnostic: `libs/pr-worktree/src/diagnostic.ts` — a fixed kebab-case `problem` union + one human
  `message`. Render with a one-liner (`libs/pr-worktree/src/render.ts`).
- gh-fetch-and-parse module modeled on `libs/pr-worktree/src/pr.ts` (`resolvePr`): one call site,
  parse JSON defensively, map gh failure → structured diagnostic, return a typed record.
- Spec style: `libs/pr-worktree/src/pr.spec.ts` — a `ghRunner(...)` fixture returning canned stdout;
  assert `ok`/`problem`.
- CLI skill wrapper: `.claude/skills/nxs-pr-worktree/scripts/pr_worktree.ts` — `#!/usr/bin/env tsx`,
  imports `@nexus/<lib>/…`, parses flags, `emit()` one JSON object on stdout / `die()` a diagnostic on
  stderr, exit `0` success · `1` diagnostic · `2` usage. `SKILL.md` = the skill doc
  (`.claude/skills/nxs-pr-worktree/SKILL.md` is the template).

### Lib scaffolding (copy pr-worktree's files, rename)

- `libs/pr-worktree/package.json` (name `@nexus/pr-worktree`, `type: module`, per-subpath `exports`
  pointing at `./src/*.ts`, `dependencies: @nexus/close-migration + @nexus/workspace`).
- `libs/pr-worktree/project.json` (nx library; empty `targets` — the `@nx/vitest` plugin infers a
  `test` target from the presence of `vitest.config.mts`).
- `libs/pr-worktree/vitest.config.mts` (node env, `include: src/**/*.spec.ts`, v8 coverage).
- `libs/pr-worktree/tsconfig.json` / `tsconfig.lib.json` / `tsconfig.spec.json` — copy; update the
  `references` in `tsconfig.lib.json` to the deps this lib actually uses (`../workspace`,
  `../close-migration`).
- Register the new lib in root `tsconfig.json` `references` (list at `/home/sameera/projects/nexus/tsconfig.json`)
  and add `"@nexus/epic-resolve": "workspace:*"` to root `package.json` devDependencies (alongside the
  existing `@nexus/pr-worktree` etc.), so the skill script can `import "@nexus/epic-resolve/…"`.
  `pnpm-workspace.yaml` uses `libs/*` glob — no change there, but run `pnpm install` to link.

### Session-scratch / gitignore conventions

- `/home/sameera/projects/nexus/.gitignore` — has `tmp/**` and `.claude/worktrees` (precedent for a
  gitignored working area). `.nexus/plans/` is retired. Decision scratch under `.nexus/queue/<epic>/`
  is committed (do NOT write the materialized epic there).
- Chosen default output location (see decision stub): a **gitignored** path under the repo,
  `.nexus/tmp/epic-<N>/epic.md`. Add one line `.nexus/tmp/` to `.gitignore`. (Refuted: OS-temp only —
  harder for a downstream stage to find at a predictable repo-relative path; gitignored-in-repo keeps
  it discoverable AND untracked.)

### CLAUDE.md obligations that bite this story

- **Re-vendor on `.claude/**` edits.** Adding `.claude/skills/nxs-epic-resolve/**` staleness the pin
  `libs/portable-tools/bundle-fingerprint.json`; `libs/portable-tools/src/parity.spec.ts` fails until
  you run `pnpm nexus:vendor-tools` and commit the regenerated pin. (Memory: revendor-on-claude-…)
- **TFD + 95% coverage** on the new lib source.
- **Decision stubs** for non-obvious choices at
  `.nexus/queue/issue-sourced-planning-68be4a6b/sameera/decisions-epic-issue-sourced-planning.md`.

---

## 4. Out of scope (other stories' turf — do NOT touch)

- **Do NOT change `/nxs.hld` or `/nxs.analyze` read paths** (`.claude/commands/nxs.hld.md`,
  `nxs.analyze.md`) — Story 4 / #116 flips them onto the resolver.
- **Do NOT change `/nxs.close`** (`.claude/commands/nxs.close.md`) — Story 5 / #117 makes it
  materialize + commit the born-at-close entry.
- **Do NOT build `--from` wiring into `/nxs.epic`** (`.claude/commands/nxs.epic.md`) — Story 3 / #118.
  In particular the **epic-vs-story validation** ("target is really an epic") is Story 3's security
  boundary (invariant 18); Story 1 needs only enough to fetch a valid epic. Keep a minimal diagnostic
  set; do not build `--from`'s "not-an-epic" UX here.
- **Do NOT change `/nxs.epic`'s no-commit planning behavior** — Story 2 / #119.
- Story 1 ships ONLY the resolver (lib + CLI skill) as shared substrate that breaks nothing. No
  existing command may start calling it in this story.

---

## 5. Tests first (TFD order — write these red, then implement)

All specs live in `libs/epic-resolve/src/*.spec.ts` and inject a `Runner` (canned `gh` stdout) — no
network. Follow `pr.spec.ts` style.

**Fixtures.** A `ghRunner(graph)` helper that answers: the sub-issues GraphQL query (returns an
ordered list of sub-issue numbers), each `gh issue view <n> --json …` (returns canned title/body),
and each `.../dependencies/blocked_by` (returns canned blocker numbers). Build small in-memory epic
graphs (e.g. epic #115 with sub-issues #116,#117 where #117 blocked_by #116).

### AC1 — all-or-nothing, N stories in one file

1. **N sub-issues → one epic with all N stories.** Graph with 3 sub-issues → `resolveEpic` returns
   `ok:true`; the serialized markdown contains a `## User Stories` section with 3 `### Story` entries,
   one per sub-issue, each carrying that sub-issue's body text. Assert all three story titles appear.
2. **Unfetchable sub-issue → hard fail, no output.** Graph where sub-issue #117's `gh issue view`
   returns `status:1` → `resolveEpic` returns `ok:false` with a `subissue-fetch-failed` (or
   `gh-failed`) problem. Then at the write layer: `writeMaterializedEpic` is never reached / the
   destination file does NOT exist after the CLI path runs on this graph. (Assert the fail result;
   assert no file written.)
3. **Epic itself unfetchable → hard fail.** `gh issue view <epic>` status:1 → `ok:false`,
   `epic-not-found` / `gh-failed`; no stories fetched, no output.
4. **Malformed gh JSON → diagnostic, not a crash.** `gh issue view` returns `"not json"` →
   `ok:false`, `malformed-json` (mirror `pr.spec.ts` "flags unparseable JSON").

### AC2 — byte-identical idempotency

5. **Two serializations equal.** Call `resolveEpic` twice over the same canned graph → the two output
   strings are `===`.
6. **Order-independent (canonical ordering).** Same graph, but the sub-issues GraphQL fixture returns
   nodes in a **shuffled** order on the second call → output still byte-identical. (Proves ordering is
   derived from a stable key — ascending issue number — not from GitHub's return order.)
7. **No volatile fields.** Assert the output contains no ISO timestamp / `createdAt` / `updatedAt` /
   run-id substring (regex assertion), so re-runs cannot diverge on wall-clock data.

### AC3 — ephemeral / gitignored, git status clean

8. **Default output path is gitignored, tree stays clean.** In a `mkdtemp` git repo seeded with the
   project `.gitignore` (including the new `.nexus/tmp/` line): call
   `writeMaterializedEpic(root, 115, "<canned md>")`, assert the returned path is under
   `root/.nexus/tmp/`, the file exists with the given content, and `git status --porcelain` (run via
   the Runner/`spawnSync` in the temp repo) is **empty** — no new tracked/untracked file surfaces.

### AC4 — dependency column reproduces native deps exactly

9. **Edges reproduced exactly.** Graph: sub-issues #116 (no deps), #117 (blocked_by #116) → the
   `## Implementation Sequence` table has rows in canonical order with a `blocked_by` column where the
   #117 row lists the synthesized ref of #116 and the #116 row lists `none`. Parse the table and
   assert the edge set equals exactly `{ (#117 → #116) }`.
10. **None invented.** A graph with zero dependencies → every `blocked_by` cell is `none`; no ref
    appears anywhere in the column.
11. **Live deps beat a stale baked-in table.** Epic body fixture contains a stale
    `## Implementation Sequence` listing a WRONG edge; the live `blocked_by` fixture says otherwise →
    the emitted table reflects the LIVE edges, and the stale table does not survive (only one
    `## Implementation Sequence` section in the output).

### Serialization shape (supports the "field shape" intent + the conflict)

12. **User Stories re-inserted at a stable anchor.** Output places `## User Stories` after `## Personas`
    (or the chosen deterministic anchor) and before `## Assumptions`; assert section order.
13. **Recoverable frontmatter only; nothing fabricated.** Output frontmatter carries `epic:` (title)
    and `link: "#115"` and does NOT contain fabricated `slug`/`complexity`/`feature_path` values
    (assert those keys are absent, per the §3 conflict — the resolver must not invent them).

---

## 6. Steps (ordered — cite file + anchor)

1. **Scaffold the lib** `libs/epic-resolve/` by copying and renaming the six scaffolding files from
   `libs/pr-worktree/` (`package.json`, `project.json`, `vitest.config.mts`, `tsconfig.json`,
   `tsconfig.lib.json`, `tsconfig.spec.json`). Set name `@nexus/epic-resolve`, `test.name`
   `epic-resolve`, cacheDir `../../node_modules/.vite/libs/epic-resolve`, deps
   `@nexus/close-migration` + `@nexus/workspace`, and `tsconfig.lib.json` `references` to
   `../workspace` + `../close-migration`.
2. **Register the lib:** add `{ "path": "./libs/epic-resolve" }` to root
   `/home/sameera/projects/nexus/tsconfig.json` `references`; add
   `"@nexus/epic-resolve": "workspace:*"` to root `package.json` devDependencies. Run `pnpm install`.
3. **`src/run.ts`** — re-export the Runner seam: `export { type RunResult, type Runner, defaultRunner, git } from "@nexus/close-migration/run";` (identical to `libs/pr-worktree/src/run.ts`).
4. **`src/diagnostic.ts`** — `EpicResolveDiagnostic` = `{ problem, message }` with a lean union:
   `epic-not-found | not-a-git-repo | gh-failed | malformed-json | subissue-fetch-failed | usage`.
   Model on `libs/pr-worktree/src/diagnostic.ts`. **`src/render.ts`** — one-line renderer
   (`epic-resolve <problem>: <message>`), model on `libs/pr-worktree/src/render.ts`.
5. **`src/gh.ts`** — the GitHub read layer over the Runner (pure, model on `libs/pr-worktree/src/pr.ts`):
   - `fetchEpic(run, cwd, epicNumber)` → `{ title, body }` (via `gh issue view … --json title,body`);
     map not-found / malformed / non-zero to diagnostics.
   - `fetchSubIssueNumbers(run, cwd, epicNumber)` → ordered `number[]` via the GraphQL `subIssues`
     query from `nxs.close.md` (§3). Empty list is valid (epic with 0 stories).
   - `fetchStory(run, cwd, subNumber)` → `{ number, title, body }`; a non-zero exit is
     `subissue-fetch-failed` (drives AC1 fail-closed).
   - `fetchBlockedBy(run, cwd, subNumber)` → blocker `number[]` via
     `gh api repos/{owner}/{repo}/issues/<n>/dependencies/blocked_by --jq '.[].number'`.
6. **`src/serialize.ts`** — pure serializer (no fs, no gh). Input: epic `{title, body}`, ordered
   stories `[{number,title,body}]`, and the dep map `number → blocker numbers[]`. Output: the
   `epic.md` string. Rules (all deterministic):
   - **Canonical order** = stories sorted by ascending issue number. Assign `STORY-<epicNumber>.<SEQ>`
     (SEQ zero-padded, 01-based, in canonical order).
   - **Frontmatter:** emit only recoverable keys — `epic: "<title>"`, `link: "#<epicNumber>"` (and
     `type:` only if you fetched it; else omit). Do NOT emit `slug`/`feature_path`/`complexity`/etc.
     (§3 conflict — no fabrication).
   - **Body:** take the fetched epic body verbatim (it begins at `# Epic:`), strip any existing
     `## Implementation Sequence` H2 section (same H2-boundary logic as
     `nxs_gh_create_epic.py:strip_story_bodies`), insert the rebuilt `## User Stories` at a fixed
     anchor (after `## Personas` if present, else immediately before `## Assumptions`, else after the
     Description block — pick and document ONE rule).
   - **`## User Stories`:** one `### Story <SEQ>: <story title>` per story + its body. (Do not
     fabricate `story_type`/`size` — §3.)
   - **`## Implementation Sequence`:** append at the end; table `| STORY | Issue | blocked_by |` with a
     row per story in canonical order; `blocked_by` cell = comma-joined blocker STORY refs (mapped from
     the live blocker numbers via the canonical-ref map) or `none`. This is the AC4 section — built
     from live deps only.
7. **`src/resolve.ts`** — `resolveEpic(run, cwd, epicNumber): { ok:true, markdown } | { ok:false, error }`.
   Orchestrate: fetchEpic → fetchSubIssueNumbers → fetchStory for each (fail-closed: first failure
   returns error, nothing serialized) → fetchBlockedBy for each → `serialize(...)`. Pure over the
   Runner; returns the string, does not write (keeps AC2 testable by string compare).
8. **`src/write.ts`** — `defaultOutPath(root, epicNumber)` → `path.join(root, ".nexus", "tmp",
   `epic-${n}`, "epic.md")`; `writeMaterializedEpic(root, epicNumber, markdown)` → mkdir -p + write,
   return the path. Only ever called on `ok:true`.
9. **`.gitignore`** — add a single line `.nexus/tmp/` to `/home/sameera/projects/nexus/.gitignore`
   (keeps the materialized epic untracked — AC3).
10. **Skill CLI** `.claude/skills/nxs-epic-resolve/scripts/epic_resolve.ts` — `#!/usr/bin/env tsx`,
    model on `.claude/skills/nxs-pr-worktree/scripts/pr_worktree.ts`. Flags: `--epic <N>` (required),
    `--out <path>` (optional; default `defaultOutPath`). Resolve the target root via
    `resolveWorkspace(process.cwd())` (hubRoot for workspace, root for single-repo; `die` on its
    diagnostic). Call `resolveEpic(defaultRunner, targetRoot, N)`; on `ok:false` `die`; on `ok:true`
    `writeMaterializedEpic` and `emit({ epicNumber, outPath })`. Exit codes 0/1/2.
11. **Skill doc** `.claude/skills/nxs-epic-resolve/SKILL.md` — model on
    `.claude/skills/nxs-pr-worktree/SKILL.md`: purpose, usage, contract (JSON on stdout, diagnostic on
    stderr, read-only, single-repo + hub via the workspace resolver, exit codes).
12. **Write all specs from §5 first (red), then implement 3–11 to green.**
13. **Re-vendor:** run `pnpm nexus:vendor-tools`; commit the regenerated
    `libs/portable-tools/bundle-fingerprint.json` (parity gate — CLAUDE.md).
14. **Decision stub:** record the non-obvious choices (output-location = gitignored `.nexus/tmp/`;
    canonical ordering = ascending issue number; frontmatter fields omitted not fabricated; User
    Stories insertion anchor) in
    `.nexus/queue/issue-sourced-planning-68be4a6b/sameera/decisions-epic-issue-sourced-planning.md`.

---

## 7. Done checklist

- [ ] `pnpm nx test @nexus/epic-resolve` green (all §5 specs pass; TFD order respected).
- [ ] `pnpm nx test @nexus/portable-tools` (or `pnpm nexus:vendor-tools` first) — parity passes after
      committing the regenerated `libs/portable-tools/bundle-fingerprint.json` (new skill was added).
- [ ] Lib source ≥ 95% coverage (vitest v8 report under `libs/epic-resolve/test-output/`); coverage is
      a signal — no internal-only tests added to game it.
- [ ] `git status` after a real resolver run shows **no** new tracked file (AC3 — the materialized
      epic lands under gitignored `.nexus/tmp/`).
- [ ] All four ACs demonstrably covered by named tests: AC1 (tests 1–4), AC2 (5–7), AC3 (8),
      AC4 (9–11).
- [ ] No existing command/read-path changed (§4). `.claude/commands/*` untouched.
- [ ] Decision stub written (§6 step 14).
- [ ] Commit message: `feat(#115): The resolver rebuilds an epic from its issue number`
      (end with the `Co-Authored-By: Claude …` trailer per repo git convention).
- [ ] Reported to the lead: the §3 CONFLICT (frontmatter + `story_type`/`size` + `STORY` refs are not
      recoverable from issues as filed today) — resolution belongs to Stories 4/5, flagged here.
```
