/**
 * The writer stamp (story #306): every artifact the toolkit writes that a later stage reads back
 * records which toolkit wrote it.
 *
 * Four artifacts carry data a later stage reads and checks — the analyze receipt, the close
 * record, and the machine blocks in the close comment and the analyze PR review. A change to how
 * any of that is canonicalised would otherwise silently invalidate every in-flight receipt, with
 * nothing able to say which ones were affected. The stamp makes that detectable. It replaces the
 * refuted per-repository version pin at none of the pin's cost: the artifact is being written
 * anyway, so stamping it produces no commit that would not have happened.
 *
 * Three properties fix the contract, and the tests beside this module pin all three:
 *
 * 1. **One field name, everywhere.** Most of these artifacts are written by prose commands, not
 *    by this program, so the name is declared here and every writing and reading surface is
 *    checked against it rather than each spelling it independently.
 * 2. **An absent stamp is an unknown writer, never a failure.** Artifacts written before this
 *    story carry none, and a stage that refused them would break work already in flight.
 * 3. **The stamp is outside every hash a stage verifies.** It sits in the key/value frontmatter
 *    or machine block beside the hashes, never inside the bytes any digest covers, so stamping an
 *    artifact cannot change a value a later stage compares.
 *
 * This story introduces no ladder: a stage that reads a version different from its own completes
 * normally. Detecting a difference is what the stamp is for; deciding what to do about one can
 * follow the evidence.
 */

/** The one key the stamp is written and read under, in every artifact that carries it. */
export const WRITER_STAMP_FIELD = "nexus_version";

/** What a reader knows about an artifact's writer when the artifact carries no stamp. */
export const UNKNOWN_WRITER = null;

/**
 * The stamp line a writer emits, given the release it is part of. An unresolved release yields no
 * line at all — an absent stamp already means "unknown writer", while a fabricated version would
 * assert something untrue about work in flight.
 */
export function writerStampLine(version: string | null): string | null {
    return version === null ? null : `${WRITER_STAMP_FIELD}: ${version}`;
}

/**
 * The writer of an artifact, given its already-parsed key/value fields. An artifact with no stamp
 * reads back as `UNKNOWN_WRITER`, which every stage treats as a writer it cannot name — never as
 * a reason to stop.
 */
export function readWriterStamp(fields: ReadonlyMap<string, string>): string | null {
    const stamped: string | undefined = fields.get(WRITER_STAMP_FIELD);
    return stamped === undefined || stamped.trim() === "" ? UNKNOWN_WRITER : stamped.trim();
}
