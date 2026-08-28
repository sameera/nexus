/**
 * The one target-root convention every repo-bound TypeScript entry point accepts through
 * (decision record #283): a single named flag, defaulting to the working directory when
 * omitted. A named flag — not a leading positional — because several entry points already carry
 * meaningful positional arguments of their own; a positional root either collides with those or
 * is distinguished only by argument count, and an operator who omits it would silently bind the
 * *next* argument as the root.
 *
 * Both the compiled command surface (`nexus-cli.ts`) and the in-repo development-script vehicle
 * (the component skills' own scripts) import this same implementation rather than
 * each parsing the flag themselves, so the two surfaces cannot name it differently or default it
 * differently — the parity corpus (`parity.spec.ts`) is the structural check that would catch a
 * divergence if one crept in regardless.
 */

/** The canonical flag name every repo-bound TypeScript entry point parses. */
export const TARGET_ROOT_FLAG = "--root";

export interface TargetRootParse {
    /** The resolved root: the flag's value, or `cwd` when the flag is absent or valueless. */
    root: string;
    /** `argv` with the flag (and its value, if any) removed, in original order. */
    rest: string[];
}

/**
 * Extract {@link TARGET_ROOT_FLAG} from `argv`, defaulting to `cwd` when it is absent — the
 * default is a fallback, never a definition (decision record #283, Invariant 1).
 */
export function takeTargetRoot(argv: string[], cwd: string): TargetRootParse {
    const rest: string[] = [...argv];
    const index: number = rest.indexOf(TARGET_ROOT_FLAG);
    if (index === -1) {
        return { root: cwd, rest };
    }
    const value: string | undefined = rest[index + 1];
    rest.splice(index, value === undefined ? 1 : 2);
    return { root: value ?? cwd, rest };
}
