/**
 * The toolkit's output seam.
 *
 * Every capability writes through this rather than through `console`, so a spec asserts what a
 * capability printed — and on which stream — without capturing process output. `cwd` is the
 * invoking working directory, which is what a `--root` default resolves against.
 */

export interface ToolkitIo {
    /** The invoking working directory (the repo a capability acts on / resolves from). */
    cwd: string;
    stdout: (line: string) => void;
    stderr: (line: string) => void;
}

/** The io the installed entry point runs with: the real streams and the real cwd. */
export function processIo(): ToolkitIo {
    return {
        cwd: process.cwd(),
        stdout: (line: string) => process.stdout.write(`${line}\n`),
        stderr: (line: string) => process.stderr.write(`${line}\n`),
    };
}
