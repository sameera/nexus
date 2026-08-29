/**
 * Which failures are worth trying again (story #369).
 *
 * The three tiers are kept exactly as they are today (decision record #375): calls that retry with
 * exponential backoff and jitter, calls that deliberately do not, and the plain runner handed to
 * the shared helpers. Which calls retry is observable — as latency, as warning lines, and for the
 * label upsert as whether a permission gap is reported before anything is created — so normalising
 * the tiers would be an improvement, and improvements are out of scope.
 */

import { type GhRunner, type RunResult } from "../gh.js";
import { type ToolkitIo } from "../io.js";
import { type FilerEnvironment } from "./environment.js";

/** A `gh` call that failed after exhausting retries, or failed deterministically. */
export class GhError extends Error {
    constructor(
        readonly args: string[],
        readonly status: number,
        readonly stderr: string,
        readonly attempts: number,
    ) {
        super(`gh failed after ${attempts} attempt(s) (exit ${status}): ${stderr.trim()}`);
        this.name = "GhError";
        this.stderr = stderr.trim();
    }
}

/**
 * The markers of a *transient* failure. A deterministic one — validation, authentication,
 * not-found — is never retried, because retrying cannot fix it and the delay is pure cost.
 */
export const TRANSIENT_MARKERS: readonly string[] = [
    "http 500",
    "http 502",
    "http 503",
    "http 504",
    "internal server error",
    "bad gateway",
    "service unavailable",
    "gateway timeout",
    "rate limit",
    "secondary rate",
    "abuse detection",
    "timeout",
    "timed out",
    "connection reset",
    "connection refused",
    "could not resolve host",
    "temporary failure",
    "eof",
    "tls handshake",
];

export function isTransient(stderr: string): boolean {
    const text: string = (stderr ?? "").toLowerCase();
    return TRANSIENT_MARKERS.some((marker) => text.includes(marker));
}

/** A runner that succeeds or throws `GhError` — the shape the platform calls are written against. */
export type RetryingRunner = (args: string[]) => RunResult;

export interface RetryTuning {
    /** Extra attempts after the first, for transient failures. */
    retries: number;
    /** Backoff base, in seconds. */
    baseDelay: number;
}

export function retryingRunner(
    run: GhRunner,
    tuning: RetryTuning,
    env: FilerEnvironment,
    io: ToolkitIo,
): RetryingRunner {
    return (args: string[]): RunResult => {
        for (let attempt = 0; ; attempt++) {
            const result: RunResult = run(args);
            if (result.status === 0) return result;
            const stderr: string = result.stderr ?? "";
            if (attempt >= tuning.retries || !isTransient(stderr)) {
                throw new GhError(args, result.status, stderr, attempt + 1);
            }
            const delay: number = tuning.baseDelay * 2 ** attempt + env.random() * tuning.baseDelay;
            io.stderr(
                `  Transient gh failure (attempt ${attempt + 1}/${tuning.retries + 1}), ` +
                    `retrying in ${delay.toFixed(1)}s: ${stderr.trim().slice(0, 140)}`,
            );
            env.sleep(delay);
        }
    };
}
