import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findQueueEntryRemovers } from "./queue-entry-remover-guard.js";
import { QUEUE_ENTRY_REMOVER_WAIVERS } from "./queue-entry-remover-waivers.js";

describe("findQueueEntryRemovers", () => {
    let tmpDirs: string[] = [];

    afterEach(() => {
        for (const dir of tmpDirs) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        tmpDirs = [];
    });

    function makeRepo(): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-remover-guard-"));
        tmpDirs.push(dir);
        return dir;
    }

    it("finds nothing in a repo that never touches the committed queue", () => {
        const repo = makeRepo();
        fs.mkdirSync(path.join(repo, "libs", "example", "src"), { recursive: true });
        fs.writeFileSync(
            path.join(repo, "libs", "example", "src", "thing.ts"),
            'export function thing() { return "hello"; }\n',
        );

        expect(findQueueEntryRemovers(repo)).toEqual([]);
    });

    it("names a component file that git-rm's a committed queue path", () => {
        const repo = makeRepo();
        fs.mkdirSync(path.join(repo, "components", "commands"), { recursive: true });
        fs.writeFileSync(
            path.join(repo, "components", "commands", "nxs.example.md"),
            "```bash\ngit rm -r .nexus/queue/epic-9\n```\n",
        );

        const found = findQueueEntryRemovers(repo);
        expect(found).toHaveLength(1);
        expect(found[0].relPath).toBe("components/commands/nxs.example.md");
        expect(found[0].lines[0]).toContain("git rm -r .nexus/queue/epic-9");
    });

    it("names a shipped TS module that git-rm's a committed queue path", () => {
        const repo = makeRepo();
        fs.mkdirSync(path.join(repo, "libs", "example", "src"), { recursive: true });
        fs.writeFileSync(
            path.join(repo, "libs", "example", "src", "sneaky.ts"),
            'run("git", ["rm", "-r", ".nexus/queue/epic-9"]); // git rm .nexus/queue path\n',
        );

        const found = findQueueEntryRemovers(repo);
        expect(found.map((f) => f.relPath)).toContain("libs/example/src/sneaky.ts");
    });

    it("ignores a spec file, dist output, and node_modules", () => {
        const repo = makeRepo();
        fs.mkdirSync(path.join(repo, "libs", "example", "src"), { recursive: true });
        fs.mkdirSync(path.join(repo, "libs", "example", "dist"), { recursive: true });
        fs.mkdirSync(path.join(repo, "node_modules", "x"), { recursive: true });
        const line = "// git rm .nexus/queue/epic-9\n";
        fs.writeFileSync(path.join(repo, "libs", "example", "src", "thing.spec.ts"), line);
        fs.writeFileSync(path.join(repo, "libs", "example", "dist", "thing.js"), line);
        fs.writeFileSync(path.join(repo, "node_modules", "x", "index.js"), line);

        expect(findQueueEntryRemovers(repo)).toEqual([]);
    });

    it("does not flag a plain filesystem removal that never touches git history", () => {
        const repo = makeRepo();
        fs.mkdirSync(path.join(repo, "libs", "example", "src"), { recursive: true });
        fs.writeFileSync(
            path.join(repo, "libs", "example", "src", "rollback.ts"),
            'fs.rmSync(dest, { recursive: true, force: true }); // dest is under .nexus/queue\n',
        );

        expect(findQueueEntryRemovers(repo)).toEqual([]);
    });
});

describe("the single-remover rule (epic #215, decision record #514 invariant 6)", () => {
    it("the live tree removes a committed queue entry only at the enumerated waiver", () => {
        const repoRoot = path.resolve(__dirname, "../../..");
        const found = findQueueEntryRemovers(repoRoot).map((f) => f.relPath).sort();
        expect(found).toEqual([...QUEUE_ENTRY_REMOVER_WAIVERS].sort());
    });
});
