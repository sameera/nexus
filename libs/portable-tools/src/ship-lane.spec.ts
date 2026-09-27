/**
 * The solo lane's command text (epic #799). The lane's mechanism is a command definition, so what
 * a spec can hold it to is the rules its body states and the texts it does or does not load.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components.js";

const ROOT: string = authoredComponentRoot(__dirname);

function command(name: string): string {
    return fs.readFileSync(path.join(ROOT, "commands", name), "utf8");
}

const SHIP: string = command("nxs.ship.md");

describe("/nxs.ship checks the workspace shape, then the solo declaration (story #800)", () => {
    it("runs solo-check before any other toolkit call or file read", () => {
        const first: number = SHIP.indexOf("nexus solo-check");
        expect(first).toBeGreaterThan(-1);
        const others: RegExpMatchArray[] = [...SHIP.matchAll(/```bash\n([^`]*)```/g)];
        expect(others[0]?.[1]).toContain("nexus solo-check");
    });

    it("the --pr stages never read the solo declaration", () => {
        for (const name of ["nxs.analyze.md", "nxs.close.md"]) {
            expect(command(name)).not.toContain("solo-check");
            expect(command(name)).not.toMatch(/delivery\.solo/);
        }
    });
});
