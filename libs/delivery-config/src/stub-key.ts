/**
 * The hidden key a deferred-scope stub carries (epic #830, story #866, decision record #872, D9).
 *
 * Close files each approved deferred-scope proposal as an epic stub whose body ends in one hidden
 * line naming the epic, the pull request and the proposal. A re-run of close finds the stub it
 * already filed by that line, through the epic's back-references, so it never files a second one.
 * A stub is later promoted in place, which replaces its body; promotion carries the key line over,
 * so the stub is still recognised after it has been planned (G21).
 *
 * The key is written by close and carried by the epic filer, so its prefix lives here, below both.
 */

/** What opens the hidden key a deferred-scope stub carries. */
export const CLOSE_STUB_KEY_PREFIX = "<!-- nexus:close-stub ";

/** Every stub key line in `body`, in order. */
export function stubKeyLines(body: string): string[] {
    return body
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith(CLOSE_STUB_KEY_PREFIX) && line.endsWith("-->"));
}
