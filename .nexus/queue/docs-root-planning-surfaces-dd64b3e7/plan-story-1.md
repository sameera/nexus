# Plan — STORY-81.01: Epic planning writes land under the resolved docs root

- **Epic:** #81 "Planning Surfaces Follow the Docs Root" (`.nexus/queue/docs-root-planning-surfaces-dd64b3e7/`)
- **Story issue:** #82 · **size:** M · **blocked_by:** none
- **This is the foundation story.** It creates the docs-root **read-out** (both vehicles) that
  Stories 3 and 4 consume, and wires `/nxs.epic`'s writes through it. Do Story 1 first.

---

## 1. Goal (what "done" means)

Today `/nxs.epic` creates feature artifacts at hardcoded `docs/features/<slug>/…` paths. This story:

1. Adds a **docs-root read-out** — a single-value command that prints the resolved repo-relative
   docs root — reachable through the two vehicles the workspace-status read-out already uses:
   an **in-repo tsx script** and a **portable-CLI verb** on `nexus.mjs`.
2. Routes `/nxs.epic`'s **writes** (feature container, `backlog.md`, nav `README.md`), its
   **stub-promotion glob**, and the recorded **`feature_path`** through that read-out, so a hub
   whose docs root is the repo root creates `features/<slug>/…` and no `docs/` directory.
3. On a single-repo checkout, the read-out returns `docs`, so every path is byte-identical to today.

**Out of scope for this story (do NOT touch):**
- `/nxs.epic`'s **context reads** (`docs/product/context.md`, `docs/system/stack.md` at
  `nxs.epic.md` lines ~79–80 and ~212) — those belong to **Story 4** (#85). Leave them alone.
- `/nxs.close`, `/nxs.setup`, `/nxs.hld`, the agents — later stories.
- The cross-ref **URL** surface (`nxs-abs-doc-path` skill, `cross-ref.docs-root` in
  `settings.yml`). This story consumes only the **local filesystem** docs root. Do not modify the
  skill's URL logic.

---

## 2. Judgment calls already made — do NOT re-decide

These were decided during planning (see the epic's `decision-record.md`). Implement them as written.

1. **The read-out is a thin wrapper over `localDocsRoot`.** `libs/workspace/src/resolve.ts` already
   exports `localDocsRoot(startDir): { ok: true; docsRoot: string } | { ok: false; error: Diagnostic }`.
   It is the single producer (returns `.` for a hub, `docs` for single-repo/member, or the hub's
   override). Do **not** write a second resolver, do **not** parse the human `workspace status` render.
2. **Two vehicles, same value.** In-repo script `docs_root.ts` (run via `tsx`) for checkouts with a
   Node toolchain; a new `nexus workspace docs-root` verb (bundled into `nexus.mjs`) for a docs-only
   hub. Mirror exactly how `workspace_status.ts` and `nexus workspace status` relate.
3. **In-repo script lives in the existing `nxs-workspace-status` skill.** Add
   `.claude/skills/nxs-workspace-status/scripts/docs_root.ts` beside `workspace_status.ts`. Do **not**
   create a new skill folder.
4. **Verb name is `nexus workspace docs-root`** (a sub-verb of `workspace`, mirroring `workspace status`).
5. **Failure is surfaced, never swallowed** (decision-record ADDRESS risk). On a resolution failure
   the read-out prints the resolver's named diagnostic to **stderr** and exits **1**. A calling command
   must **stop** — it must never treat a resolution failure as "context absent" and fall back to a
   literal `docs/`. Reuse `renderWorkspaceStatus` for the failure text (see §4.1 — it type-checks after
   the `!result.ok` narrowing; do not add a new export to `status.ts`).
6. **Empty-prefix rule for a `.` docs root** (decision-record Invariant 4). A hub value is `.` (the
   repo root). When a **command** (markdown, LLM-executed) builds a path, `.` means "no prefix — hang
   the taxonomy directly off the repo root" (`features/<slug>/…`), never a `./`-prefixed path or a
   segment literally named `.`. In **TypeScript** code, `path.join(docsRoot, suffix)` collapses `.`
   for free — always use `path.join`, never string concatenation.
7. **`feature_path` records the ACTUAL resolved container path.** For a hub that is
   `features/<slug>`; for single-repo that is `docs/features/<slug>`. This recorded value is what
   `/nxs.close` reads in Story 2 — do not write a fixed `docs/features/<slug>` literal.
8. **Re-vendoring is mandatory and per-story** (portable-tooling concept, Invariant 8). Changing
   `nexus-cli.ts` restages `nexus.mjs`; adding `docs_root.ts` under `.claude/` restages the
   `claude-components` payload. Both are pinned by `libs/portable-tools/bundle-fingerprint.json`.
   You **must** regenerate the pin with `pnpm nexus:vendor-tools` and commit it, or the parity test
   fails. Never hand-edit the fingerprint JSON.

---

## 3. Files you will touch

| # | File | Change |
|---|------|--------|
| A | `.claude/skills/nxs-workspace-status/scripts/docs_root.ts` | **new** — in-repo read-out script |
| B | `libs/portable-tools/src/nexus-cli.ts` | add `workspace docs-root` verb + USAGE + import |
| C | `libs/portable-tools/src/docs-root-readout.spec.ts` | **new** — verb + script tests (TFD) |
| D | `.claude/skills/nxs-workspace-status/SKILL.md` | document the docs-root read-out |
| E | `.claude/commands/nxs.epic.md` | resolve docs root once; route container/backlog/nav/glob/`feature_path` |
| F | `libs/portable-tools/bundle-fingerprint.json` | regenerated by `pnpm nexus:vendor-tools` (do not hand-edit) |

Reference files (read, do not edit): `libs/workspace/src/resolve.ts` (`localDocsRoot`, lines 134–150),
`libs/workspace/src/status.ts` (`renderWorkspaceStatus`), `.claude/skills/nxs-workspace-status/scripts/workspace_status.ts`
(the pattern to mirror), `libs/portable-tools/src/workspace-status.spec.ts` (the verb test pattern to mirror),
`libs/portable-tools/src/cross-ref-docs-root.spec.ts` (the subprocess-test pattern to mirror).

---

## 4. Implementation (TFD — write the tests in step 4.3 FIRST, watch them fail, then 4.1–4.2)

> Order for a faithful TFD run: read §4.3, write `docs-root-readout.spec.ts`, run it (it fails —
> script/verb don't exist yet), then implement §4.1 and §4.2 until it passes.

### 4.1 New file A — `.claude/skills/nxs-workspace-status/scripts/docs_root.ts`

Create it with **exactly** this content:

```ts
#!/usr/bin/env tsx
/**
 * Print the resolved repo-relative docs root — the single-value view over the workspace resolver
 * ({@link localDocsRoot}). The in-repo vehicle of the docs-root read-out: planning commands run it
 * to learn where this checkout keeps its human docs, then prefix that value onto the unchanged
 * taxonomy suffixes (`features/`, `product/`, `system/`, `delivery/`). It derives nothing of its
 * own — it reads the same field the status read-out prints — so what it prints is exactly the
 * resolution contract's answer. Read-only by construction: the resolver never clones, fetches, or
 * writes.
 *
 * Usage:
 *     tsx docs_root.ts [dir]
 *
 *     dir  the checkout to resolve from (default: the current working directory)
 *
 * Output:
 *     stdout — the repo-relative docs root on one line: "docs" for a single-repo checkout or a
 *              workspace member, "." for a hub whose docs root is the repo root, or the hub's
 *              configured docs-root override.
 *     stderr — on a resolution failure, the resolver's named diagnostic (never a silent "docs").
 *
 * Exit codes:
 *     0 - resolved (the docs root was printed)
 *     1 - resolution failed (a named diagnostic was printed; the caller must stop, not fall back)
 */

import { localDocsRoot } from "@nexus/workspace/resolve";
import { renderWorkspaceStatus } from "@nexus/workspace/status";

function main(): void {
    const startDir = process.argv[2] ?? process.cwd();
    const result = localDocsRoot(startDir);
    if (!result.ok) {
        process.stderr.write(renderWorkspaceStatus(result) + "\n");
        process.exit(1);
    }
    process.stdout.write(result.docsRoot + "\n");
    process.exit(0);
}

main();
```

> Why `renderWorkspaceStatus(result)` type-checks: after `if (!result.ok)`, `result` narrows to
> `{ ok: false; error: Diagnostic }`, which is assignable to `ResolveResult` (its failure arm).
> `renderWorkspaceStatus` only reads `result.error` on that branch. No new export is needed.

### 4.2 Edit B — `libs/portable-tools/src/nexus-cli.ts`

**B1 — import `localDocsRoot`.** Find (line ~21):

```ts
import { resolveWorkspace, type ResolveResult } from "@nexus/workspace/resolve";
```

Replace with:

```ts
import { localDocsRoot, resolveWorkspace, type ResolveResult } from "@nexus/workspace/resolve";
```

**B2 — add the verb to the doc-comment verb list.** Find:

```ts
 *   nexus workspace status             read-only workspace status (STORY-60.03)
```

Replace with:

```ts
 *   nexus workspace status             read-only workspace status (STORY-60.03)
 *   nexus workspace docs-root          print the resolved repo-relative docs root (STORY-81.01)
```

**B3 — add the verb to USAGE.** Find:

```ts
    "  nexus workspace status      Read-only workspace status from any checkout.",
    "  nexus workspace add-repo    Add the invoking checkout to an existing workspace.",
```

Replace with:

```ts
    "  nexus workspace status      Read-only workspace status from any checkout.",
    "  nexus workspace docs-root   Print the resolved repo-relative docs root.",
    "  nexus workspace add-repo    Add the invoking checkout to an existing workspace.",
```

**B4 — dispatch the verb.** In `runWorkspaceVerb`, find the `status` block:

```ts
    if (sub === "status") {
        if (rest.length > 0) {
            io.stderr(`unknown argument for workspace status: ${rest[0]}\n${USAGE}`);
            return 2;
        }
        // The identical code path the in-repo status skill runs: resolve, render, exit by
        // result. Read-only by construction — the resolver never clones, fetches, or writes.
        const result: ResolveResult = resolveWorkspace(io.cwd);
        (result.ok ? io.stdout : io.stderr)(renderWorkspaceStatus(result));
        return result.ok ? 0 : 1;
    }
```

Insert this block **immediately after** it (before the `if (sub === "add-repo")` or the final
fallthrough — placement among sibling `if`s does not matter):

```ts
    if (sub === "docs-root") {
        if (rest.length > 0) {
            io.stderr(`unknown argument for workspace docs-root: ${rest[0]}\n${USAGE}`);
            return 2;
        }
        // The single-value view over the resolver: print only the resolved repo-relative docs
        // root, or the resolver's named diagnostic on failure (never a silent "docs"). The
        // in-repo docs_root.ts script runs this identical selector. Read-only by construction.
        const result = localDocsRoot(io.cwd);
        if (!result.ok) {
            io.stderr(renderWorkspaceStatus(result));
            return 1;
        }
        io.stdout(result.docsRoot);
        return 0;
    }
```

### 4.3 New file C — `libs/portable-tools/src/docs-root-readout.spec.ts` (write FIRST)

Mirror `workspace-status.spec.ts` (in-process verb via `runNexusCli`) and `cross-ref-docs-root.spec.ts`
(subprocess of the tsx script). Cover the four docs-root cases + failure + no-mutation + cross-vehicle
parity. Create with this content:

```ts
/**
 * The docs-root read-out (STORY-81.01). One resolved value — the repo-relative docs root — emitted
 * through both vehicles: the `nexus workspace docs-root` verb (in-process, and from the bundled
 * artifact) and the in-repo `docs_root.ts` tsx script. These specs pin the value per role (`.` for a
 * hub, `docs` for single-repo/member, the override when set), that a resolution failure exits 1 with
 * the resolver's diagnostic (never a silent "docs"), read-only-ness, and byte-parity between the two
 * vehicles (decision-record Invariant 8).
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildBundle } from "./bundle";
import { runNexusCli, type CliIo } from "./nexus-cli";

const REPO_ROOT: string = path.resolve(__dirname, "../../..");
const TSX_BIN: string = path.join(REPO_ROOT, "node_modules", ".bin", "tsx");
const SCRIPT: string = path.join(
    REPO_ROOT,
    ".claude",
    "skills",
    "nxs-workspace-status",
    "scripts",
    "docs_root.ts",
);

let tmpDirs: string[] = [];

function makeParent(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "docs-root-"));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

/** Write a hub checkout with an optional docs-root override; returns its path. */
function writeHub(parent: string, override?: string): string {
    const hub: string = path.join(parent, "docs-hub");
    fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
    const lines: string[] = [
        "hub:",
        "  name: docs-hub",
        "  remote: git@github.com:acme/docs-hub.git",
        ...(override ? [`  docs-root: ${override}`] : []),
        "members: []",
        "",
    ];
    fs.writeFileSync(path.join(hub, ".nexus", "config", "workspace.yml"), lines.join("\n"));
    return hub;
}

/**
 * Write a full workspace — a hub that DECLARES the member plus the member's own checkout, both under
 * `parent` — and return the member path. A member whose hub is not checked out resolves to a hard
 * FAILURE, not "docs"; the member docs-root case only exists inside a resolvable workspace (mirrors
 * workspace-status.spec.ts's makeWorkspace).
 */
function writeMember(parent: string): string {
    const hub: string = path.join(parent, "docs-hub");
    const member: string = path.join(parent, "web-app");
    fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
    fs.mkdirSync(path.join(member, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(
        path.join(hub, ".nexus", "config", "workspace.yml"),
        [
            "hub:",
            "  name: docs-hub",
            "  remote: git@github.com:acme/docs-hub.git",
            "members:",
            "  - name: web-app",
            "    remote: git@github.com:acme/web-app.git",
            "",
        ].join("\n"),
    );
    fs.writeFileSync(
        path.join(member, ".nexus", "config", "hub.yml"),
        "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n",
    );
    return member;
}

/** A single-repo checkout: a bare dir with neither manifest nor pointer. */
function writeSolo(parent: string): string {
    const solo: string = path.join(parent, "solo");
    fs.mkdirSync(solo, { recursive: true });
    return solo;
}

interface Captured {
    io: CliIo;
    out: string[];
    err: string[];
}

function makeIo(cwd: string): Captured {
    const out: string[] = [];
    const err: string[] = [];
    return {
        out,
        err,
        io: {
            cwd,
            stdout: (line: string): void => {
                out.push(line);
            },
            stderr: (line: string): void => {
                err.push(line);
            },
        },
    };
}

interface CliResult {
    status: number;
    stdout: string;
    stderr: string;
}

/** Run the in-repo tsx script with cwd pointed at a checkout. */
function runScript(cwd: string): CliResult {
    try {
        const stdout = execFileSync(TSX_BIN, [SCRIPT], { cwd, encoding: "utf8" });
        return { status: 0, stdout, stderr: "" };
    } catch (error) {
        const err = error as { status: number; stdout: string; stderr: string };
        return { status: err.status, stdout: err.stdout, stderr: err.stderr };
    }
}

function snapshot(root: string): Record<string, string> {
    const out: Record<string, string> = {};
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const abs: string = path.join(dir, entry.name);
            const rel: string = path.relative(root, abs);
            if (entry.isDirectory()) {
                out[rel + "/"] = "dir";
                walk(abs);
            } else {
                out[rel] = createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
            }
        }
    };
    walk(root);
    return out;
}

describe("nexus workspace docs-root (verb)", () => {
    it("prints '.' for a hub with no override, exit 0", async () => {
        const captured = makeIo(writeHub(makeParent()));
        expect(await runNexusCli(["workspace", "docs-root"], captured.io)).toBe(0);
        expect(captured.out.join("\n")).toBe(".");
        expect(captured.err).toEqual([]);
    });

    it("prints the override for a hub with an explicit docs-root", async () => {
        const captured = makeIo(writeHub(makeParent(), "docs"));
        expect(await runNexusCli(["workspace", "docs-root"], captured.io)).toBe(0);
        expect(captured.out.join("\n")).toBe("docs");
    });

    it("prints 'docs' for a member checkout", async () => {
        const captured = makeIo(writeMember(makeParent()));
        expect(await runNexusCli(["workspace", "docs-root"], captured.io)).toBe(0);
        expect(captured.out.join("\n")).toBe("docs");
    });

    it("prints 'docs' for a single-repo checkout (unchanged)", async () => {
        const captured = makeIo(writeSolo(makeParent()));
        expect(await runNexusCli(["workspace", "docs-root"], captured.io)).toBe(0);
        expect(captured.out.join("\n")).toBe("docs");
    });

    it("exits 1 with the resolver's diagnostic on a malformed manifest — never a silent 'docs'", async () => {
        const hub: string = path.join(makeParent(), "broken-hub");
        fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(hub, ".nexus", "config", "workspace.yml"), "hub: [\n");
        const captured = makeIo(hub);
        expect(await runNexusCli(["workspace", "docs-root"], captured.io)).toBe(1);
        expect(captured.err.join("\n")).toContain("Workspace resolution failed");
        expect(captured.out).toEqual([]);
    });

    it("rejects an unexpected argument, exit 2", async () => {
        const captured = makeIo(writeSolo(makeParent()));
        expect(await runNexusCli(["workspace", "docs-root", "extra"], captured.io)).toBe(2);
    });

    it("mutates nothing (read-only)", async () => {
        const parent = makeParent();
        writeHub(parent);
        const before = snapshot(parent);
        await runNexusCli(["workspace", "docs-root"], makeIo(path.join(parent, "docs-hub")).io);
        expect(snapshot(parent)).toEqual(before);
    });

    it("runs on plain node from the bundled artifact with identical output (bare runtime)", async () => {
        const hub = writeHub(makeParent());
        const toolsDir = makeParent();
        const { code } = await buildBundle(path.join(__dirname, "nexus-cli.ts"));
        const bundlePath = path.join(toolsDir, "nexus.mjs");
        fs.writeFileSync(bundlePath, code);
        const stdout = execFileSync(process.execPath, [bundlePath, "workspace", "docs-root"], {
            cwd: hub,
            encoding: "utf8",
        });
        expect(stdout.trimEnd()).toBe(".");
    });
});

describe("docs_root.ts (in-repo script) — parity with the verb", () => {
    it("prints '.' for a hub with no override, exit 0", () => {
        const result = runScript(writeHub(makeParent()));
        expect(result.status).toBe(0);
        expect(result.stdout.trimEnd()).toBe(".");
    });

    it("prints 'docs' for a single-repo checkout (unchanged)", () => {
        const result = runScript(writeSolo(makeParent()));
        expect(result.status).toBe(0);
        expect(result.stdout.trimEnd()).toBe("docs");
    });

    it("prints 'docs' for a member checkout", () => {
        const result = runScript(writeMember(makeParent()));
        expect(result.status).toBe(0);
        expect(result.stdout.trimEnd()).toBe("docs");
    });

    it("exits 1 on a malformed manifest, diagnostic on stderr", () => {
        const hub: string = path.join(makeParent(), "broken-hub");
        fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(hub, ".nexus", "config", "workspace.yml"), "hub: [\n");
        const result = runScript(hub);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Workspace resolution failed");
    });
});
```

### 4.4 Edit D — `.claude/skills/nxs-workspace-status/SKILL.md`

Add a short section documenting the docs-root read-out so the vehicle branch is discoverable. Find
the `## Usage` heading and insert this section **immediately before it**:

```markdown
## Docs-root read-out

A companion single-value read-out prints just the resolved repo-relative **docs root** — the value
every planning command prefixes onto the taxonomy (`features/`, `product/`, `system/`, `delivery/`).
It wraps the same resolver's `localDocsRoot` selector and is reached through the same two vehicles:

```bash
tsx ./.claude/skills/nxs-workspace-status/scripts/docs_root.ts
```

In a checkout with no in-repo Node toolchain (a docs-only hub), use the portable CLI instead —
`node <tools-dir>/nexus.mjs workspace docs-root` (in a workspace hub, `<tools-dir>` is `.nexus/tools`).

It prints one line: `docs` for a single-repo checkout or a workspace member, `.` for a hub whose docs
root is the repo root, or the hub's configured override. On a resolution failure it prints the named
diagnostic to stderr and exits 1 — a caller must stop, never fall back to a literal `docs/`.

```

### 4.5 Edit E — `.claude/commands/nxs.epic.md` (route the writes)

**E1 — resolve the docs root once, at the top of Phase 0.** Find:

```markdown
## Phase 0 — Resolve entry mode

1. **Resume check.**
```

Replace with (inserts a new resolution step; keep the `1. **Resume check.**` line intact after it):

```markdown
## Phase 0 — Resolve entry mode

**Resolve the docs root (once, up front — reused by every path this command builds).** Run the
docs-root read-out, the single-value view over the workspace resolver:

```bash
tsx ./.claude/skills/nxs-workspace-status/scripts/docs_root.ts
```

In a checkout with no in-repo Node toolchain (a docs-only hub), use the portable CLI instead —
`node <tools-dir>/nexus.mjs workspace docs-root` (in a workspace hub, `<tools-dir>` is `.nexus/tools`).

- It prints one line — capture it as **`<docs-root>`**: `docs` for a single-repo checkout or a
  member, `.` for a hub whose docs root is the repo root, or the hub's configured override.
- **On a non-zero exit** it printed a resolver diagnostic to stderr. **Stop and report it.** Never
  fall back to a literal `docs/` — a resolution failure is not "no feature yet".
- **Building a path under `<docs-root>` (empty-prefix rule):** if `<docs-root>` is `.`, the taxonomy
  hangs directly off the repo root (`features/<slug>/…`); otherwise prefix it
  (`<docs-root>/features/<slug>/…`). Never emit a `./`-prefixed path or a segment named `.`.

1. **Resume check.**
```

**E2 — the stub-promotion glob.** Find:

```markdown
    - A **stub reference** is a single token, no whitespace, kebab-case, that matches a `## <slug>` block with `status: proposed` in some `docs/features/*/backlog.md`. Glob the backlogs and check.
```

Replace `docs/features/*/backlog.md` with `<docs-root>/features/*/backlog.md` (per the empty-prefix
rule, that is `features/*/backlog.md` on a repo-root hub):

```markdown
    - A **stub reference** is a single token, no whitespace, kebab-case, that matches a `## <slug>` block with `status: proposed` in some `<docs-root>/features/*/backlog.md` (per the empty-prefix rule, `features/*/backlog.md` on a repo-root hub). Glob the backlogs and check.
```

**E3 — Phase 1 feature-container references.** Find:

```markdown
2. **Intent already inside a feature** → if the user referenced a `docs/features/<name>/` path or has a file open under one, use that feature.
3. **Otherwise infer and confirm once**:
    - Derive a feature **name** (Title Case) and **slug** (kebab-case) from the intent.
    - Present a single confirmation: _"I'll plan this under feature **<Name>** (`docs/features/<slug>/`). Accept, or give a different name?"_ — one prompt, cheap. Accept the user's correction if any.
    - Ensure the directory exists (`mkdir -p docs/features/<slug>`) — the queue entry's `feature_path` and any `backlog.md` need it. **Do not write `README.md` here.**
```

Replace with:

```markdown
2. **Intent already inside a feature** → if the user referenced a `<docs-root>/features/<name>/` path or has a file open under one, use that feature.
3. **Otherwise infer and confirm once**:
    - Derive a feature **name** (Title Case) and **slug** (kebab-case) from the intent.
    - Let **`<feature-path>`** be the resolved container: `<docs-root>/features/<slug>` (empty-prefix rule: `features/<slug>` on a repo-root hub). This exact string is what you record in `feature_path` and derive `backlog.md` / `README.md` from.
    - Present a single confirmation: _"I'll plan this under feature **<Name>** (`<feature-path>/`). Accept, or give a different name?"_ — one prompt, cheap. Accept the user's correction if any.
    - Ensure the directory exists (`mkdir -p <feature-path>`) — the queue entry's `feature_path` and any `backlog.md` need it. **Do not write `README.md` here.**
```

> Note the surrounding text after "**Do not write `README.md` here.**" is unchanged — match only up
> to that phrase so the Find/Replace stays unambiguous.

**E4 — Phase 2b decomposition-stub backlog.** Find:

```markdown
Append one stub per functional goal to `docs/features/<slug>/backlog.md` (create it if absent).
```

Replace with:

```markdown
Append one stub per functional goal to `<feature-path>/backlog.md` (the resolved container from Phase 1; create it if absent).
```

**E5 — Phase 3 "nav index not written here" note.** Find:

```markdown
The feature nav index (`docs/features/<slug>/README.md`) is **not** written here.
```

Replace with:

```markdown
The feature nav index (`<feature-path>/README.md`) is **not** written here.
```

**E6 — Phase 6 nav-index write.** Find:

```markdown
6. **Write the feature nav index.** Now that the issue exists, write `docs/features/<slug>/README.md`
```

Replace with:

```markdown
6. **Write the feature nav index.** Now that the issue exists, write `<feature-path>/README.md`
```

**E7 — the `feature_path` frontmatter template.** Find (in the "Epic document structure" block):

```markdown
feature_path: docs/features/<slug>
```

Replace with (record the ACTUAL resolved container, not this literal):

```markdown
feature_path: <feature-path>   # the ACTUAL resolved container from Phase 1 — e.g. `docs/features/onboarding` in single-repo, `features/onboarding` on a repo-root hub. Never a fixed `docs/…` literal.
```

**E8 — the `nxs-abs-doc-path` invocation (fix arg + the `.py`→`.ts` bug).** Find:

```bash
python ./.claude/skills/nxs-abs-doc-path/scripts/get_abs_doc_path.py "docs/features/<slug>/README.md"
```

Replace with (pass the resolved README path; the skill strips the docs root itself — Invariant 9,
leave the skill untouched. Also corrects the stale `.py` name — the script is `.ts`, run via `tsx`):

```bash
tsx ./.claude/skills/nxs-abs-doc-path/scripts/get_abs_doc_path.ts "<feature-path>/README.md"
```

> **Do NOT edit** `nxs.epic.md` lines ~79–80 (`docs/product/context.md` / `docs/system/stack.md`
> calibration read) or ~212 (`docs/product/context.md` personas read). Those are context reads owned
> by **Story 4**. Leave them exactly as they are.

---

## 5. Re-vendor and verify (run in order)

```bash
# 1. Regenerate the fingerprint pin (nexus.mjs verb + docs_root.ts payload both changed).
pnpm nexus:vendor-tools
#    -> rewrites libs/portable-tools/bundle-fingerprint.json. Commit that file.

# 2. Run the affected test suites.
pnpm nx test portable-tools   # docs-root-readout.spec.ts + parity.spec.ts (pin match) must pass
pnpm nx test workspace        # resolver selector unchanged; sanity

# 3. Manually exercise the read-out (single-repo — expect "docs", exit 0):
tsx ./.claude/skills/nxs-workspace-status/scripts/docs_root.ts ; echo "exit=$?"
```

If `parity.spec.ts` fails with a fingerprint mismatch, you skipped step 1 — run `pnpm nexus:vendor-tools`
and re-commit the pin. Do not hand-edit the JSON.

---

## 6. Acceptance-criteria mapping (Story 1 / #82)

- **AC-1 (hub → container/backlog/nav under `<root>/features/<slug>/`, no `docs/`):** Edits E1, E3,
  E4, E6 route the container, `backlog.md`, and nav `README.md` through `<docs-root>` with the
  empty-prefix rule → on a repo-root hub they land at `features/<slug>/…` and no `docs/` dir appears.
- **AC-2 (single-repo → paths unchanged):** the read-out returns `docs` for single-repo, so every
  `<docs-root>/features/<slug>/…` reproduces `docs/features/<slug>/…` byte-for-byte. Pinned by the
  `docs`-case tests in `docs-root-readout.spec.ts`.
- **AC-3 (`feature_path` records the resolved container):** Edit E7.
- **AC-4 (stub-promotion glob searches under the resolved root):** Edit E2.

## 7. Definition of done

- [ ] `docs_root.ts` and the `workspace docs-root` verb exist; `docs-root-readout.spec.ts` passes
      (both vehicles, four cases, failure→exit 1, no-mutation, bare-runtime parity).
- [ ] `pnpm nx test portable-tools` and `pnpm nx test workspace` are green (incl. `parity.spec.ts`).
- [ ] `libs/portable-tools/bundle-fingerprint.json` regenerated via `pnpm nexus:vendor-tools` and committed.
- [ ] `nxs.epic.md` resolves `<docs-root>` once and routes container/backlog/nav/glob/`feature_path`
      through it; the two Story-4 context-read lines are untouched.
- [ ] `SKILL.md` documents the docs-root read-out and both vehicles.
