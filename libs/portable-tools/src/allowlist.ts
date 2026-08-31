/**
 * The permission allowlist entry (stories #313, #318, #397): the entry an adopter adds once, for
 * their account, so the executable is not re-approved per repository. It counted one entry per
 * named toolkit until the second name was withdrawn; a stale second entry left in an adopter's
 * existing settings file is inert, so no migration is owed.
 *
 * Nexus writes the components it owns and never the files governing what those components are
 * permitted to do (decision record #339, invariant 2) — so this is text, printed and documented,
 * never a settings write. Three surfaces must carry it byte-identically: the install verb's output,
 * the install documentation and the upgrade notes. They share this one constant and a test fails
 * when any of the three diverges (invariant 17).
 */

/** One trailing-wildcard prefix entry — it covers every verb and every argument list. */
export const ALLOWLIST_ENTRIES: readonly string[] = ["Bash(nexus:*)"];

/**
 * The block as an adopter reads it. Account-scoped by construction: the entries belong in the
 * settings file at the install location, not in a repository-local one, because the install itself
 * is per account.
 */
export const ALLOWLIST_BLOCK: string = [
    "Add this entry to your account-scoped settings file (settings.json at the install location),",
    "not to a repository-local one:",
    "",
    `    ${ALLOWLIST_ENTRIES[0]}`,
    "",
    "Nexus writes no settings file. Adding it is your action.",
].join("\n");

/** The block as printed lines, for a verb whose IO is line-oriented. */
export function allowlistNoticeLines(): string[] {
    return ALLOWLIST_BLOCK.split("\n");
}
