/**
 * The one definition of "Nexus-namespaced" (decision record #339, invariant 1).
 *
 * Every caller that decides whether Nexus owns a file — the component mirror, the removal verb,
 * the migration verb and the duplicate guard — asks this module and never re-implements the rule.
 * The rule is about a PATH SEGMENT, not a file name: a file is Nexus-owned when the first segment
 * beneath a managed subtree carries the namespace prefix, so a whole `skills/nxs-setup/` directory
 * is owned by its directory name and an adopter's own file sitting beside it is not.
 */

/** The namespace prefixes the retired update script established and the package still owns. */
const NAMESPACE_PREFIXES: readonly string[] = ["nxs.", "nxs-"];

/** True for a single path segment Nexus owns. */
export function isNexusNamespaced(segment: string): boolean {
    return NAMESPACE_PREFIXES.some((prefix) => segment.startsWith(prefix));
}

/**
 * True when a component-root-relative path names a file Nexus owns under a managed subtree —
 * the first segment beneath the subtree carries the prefix. Paths with no subtree segment (a file
 * sitting at the component root) are not owned by this rule; only migration widens to those, and
 * it does so by asking `isNexusNamespaced` about the bare name.
 */
export function isNexusNamespacedPath(rel: string): boolean {
    const segments: string[] = rel.split("/");
    return segments.length > 1 && isNexusNamespaced(segments[1]);
}
