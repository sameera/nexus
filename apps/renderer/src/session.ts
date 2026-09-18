/**
 * The reader's session, carried nowhere but in the reader's own browser. The value is sealed
 * with authenticated encryption under a key the environment hands the instance, so the
 * handler still keeps nothing between requests and a reader cannot read or alter what they
 * carry (decision record #660).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * The `__Host-` prefix is the browser's own enforcement of the binding: a cookie under it is
 * only accepted when it is secure, path-wide and named no domain, so no build or environment
 * condition can turn those off.
 */
export const SESSION_COOKIE = "__Host-nexus-session";
export const FLOW_COOKIE = "__Host-nexus-flow";

/** What a completed sign-in leaves in the reader's browser. */
export interface SessionValue {
    readonly token: string;
    readonly expiresAt: number;
}

/** What a sign-in in progress leaves there: the parsed address, and the value GitHub echoes. */
export interface FlowValue {
    readonly store: string;
    readonly commit: string;
    readonly path: string;
    readonly nonce: string;
}

const ALGORITHM = "aes-256-gcm";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export function seal(key: Uint8Array, value: unknown): string {
    const iv = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const sealed = Buffer.concat([
        cipher.update(JSON.stringify(value), "utf8"),
        cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString("base64url");
}

/** The sealed value, or nothing at all: an altered or foreign value is simply not a session. */
export function open<T>(key: Uint8Array, sealed: string): T | null {
    try {
        const raw = Buffer.from(sealed, "base64url");
        if (raw.length <= NONCE_BYTES + TAG_BYTES) return null;

        const decipher = createDecipheriv(ALGORITHM, key, raw.subarray(0, NONCE_BYTES));
        decipher.setAuthTag(raw.subarray(NONCE_BYTES, NONCE_BYTES + TAG_BYTES));
        const opened = Buffer.concat([
            decipher.update(raw.subarray(NONCE_BYTES + TAG_BYTES)),
            decipher.final(),
        ]);
        return JSON.parse(opened.toString("utf8")) as T;
    } catch {
        return null;
    }
}

/**
 * `SameSite=Lax` is what lets the cookie arrive when a reader clicks a mockup link on a GitHub
 * issue page, while still keeping it off a background request another site sends.
 */
export function sealedCookie(name: string, value: string, seconds: number): string {
    return `${name}=${value}; Path=/; Max-Age=${seconds}; HttpOnly; Secure; SameSite=Lax`;
}

export function cleared(name: string): string {
    return sealedCookie(name, "", 0);
}

export function cookieFrom(header: string | null, name: string): string | null {
    if (header === null) return null;
    for (const pair of header.split(";")) {
        const at = pair.indexOf("=");
        if (at === -1) continue;
        if (pair.slice(0, at).trim() === name) return pair.slice(at + 1).trim();
    }
    return null;
}
