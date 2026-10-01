/**
 * A story's fingerprint (epic #827, decision record #837, D6): the one record-digest program
 * applied to the story's issue body as fetched from the issues repository.
 *
 * One digest program is already the rule for the decision record, and a second would drift. The
 * title is not part of it — acceptance criteria live in the body. The normalisation is the record
 * digest's own: line endings and trailing whitespace on each line are normalised, because GitHub
 * can rewrite line endings when a body is stored, and every other edit counts. The full digest is
 * recorded and compared; it is never shortened.
 */

import { fetchRecord } from "@nexus/record-digest/fetch";
import { type Runner } from "./run.js";
import { type StoryReadFailure } from "./story-prs.js";

export type StoryFingerprintRead = { ok: true; digest: string } | { ok: false; cause: string };

/** The fingerprint of `story`'s current body in `issuesRepo` — never the checkout's own repository. */
export function storyFingerprint(run: Runner, cwd: string, issuesRepo: string, story: number): StoryFingerprintRead {
    const r = fetchRecord(run, cwd, story, issuesRepo);
    if (!r.ok) return { ok: false, cause: r.error.message.replace("record issue", "story") };
    return { ok: true, digest: r.record.digest };
}

export type FingerprintStoriesResult = { ok: true; fingerprints: Record<number, string> } | { ok: false; failures: StoryReadFailure[] };

/** One fingerprint per story, or every story whose text could not be fetched. */
export function fingerprintStories(run: Runner, cwd: string, issuesRepo: string, stories: readonly number[]): FingerprintStoriesResult {
    const fingerprints: Record<number, string> = {};
    const failures: StoryReadFailure[] = [];
    for (const story of [...stories].sort((a, b) => a - b)) {
        const r = storyFingerprint(run, cwd, issuesRepo, story);
        if (r.ok) fingerprints[story] = r.digest;
        else failures.push({ story, cause: r.cause });
    }
    return failures.length > 0 ? { ok: false, failures } : { ok: true, fingerprints };
}
