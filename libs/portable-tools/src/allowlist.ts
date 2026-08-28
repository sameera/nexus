/**
 * The permission allowlist entries (stories #313 and #318): the two entries an adopter adds once,
 * for their account, so the two named toolkits are not re-approved per repository.
 *
 * Nexus writes the components it owns and never the files governing what those components are
 * permitted to do (decision record #339, invariant 2) — so this is text, printed and documented,
 * never a settings write. Three surfaces must carry it byte-identically: the install verb's output,
 * the install documentation and the upgrade notes. They share this one constant and a test fails
 * when any of the three diverges (invariant 17).
 */

/** One trailing-wildcard prefix entry per named toolkit — each covers every verb and argument. */
export const ALLOWLIST_ENTRIES: readonly string[] = ["Bash(nexus:*)", "Bash(nexus-gh:*)"];

/**
 * The block as an adopter reads it. Account-scoped by construction: the entries belong in the
 * settings file at the install location, not in a repository-local one, because the install itself
 * is per account.
 */
export const ALLOWLIST_BLOCK: string = [
    "Add these two entries to your account-scoped settings file (settings.json at the install location),",
    "not to a repository-local one:",
    "",
    `    ${ALLOWLIST_ENTRIES[0]}`,
    `    ${ALLOWLIST_ENTRIES[1]}`,
    "",
    "Nexus writes no settings file. Adding these entries is your action.",
].join("\n");

/** The block as printed lines, for a verb whose IO is line-oriented. */
export function allowlistNoticeLines(): string[] {
    return ALLOWLIST_BLOCK.split("\n");
}
