/**
 * Signing the reader in. The renderer borrows the reader's own access rather than holding one
 * of its own, so this is the whole of what it knows about credentials: where to send a reader
 * who must sign in, and what to do with the one endpoint GitHub returns them to.
 *
 * The token exchange, the clock and the source of randomness are supplied rather than reached
 * for, so the flow is exercisable without a network and without a process (invariant 12).
 */
import { type PinnedAddress } from "./address.js";
import { refuse, type RefusalKind } from "./refusal.js";
import {
    FLOW_COOKIE,
    SESSION_COOKIE,
    cleared,
    cookieFrom,
    open,
    seal,
    sealedCookie,
    type FlowValue,
    type SessionValue,
} from "./session.js";

/** The one endpoint this epic adds. GitHub returns the reader here and nowhere else. */
export const CALLBACK_PATH = "/auth/callback";

/** How long a sign-in may take before the flow it began is no longer a flow. */
const FLOW_SECONDS = 600;

const AUTHORIZE = "https://github.com/login/oauth/authorize";

export interface TokenGrant {
    readonly token: string;
    /** The life GitHub itself gives the token. The session is never given a longer one. */
    readonly expiresInSeconds: number;
}

export interface AuthDependencies {
    readonly clientId: string;
    /** 32 bytes the environment hands the instance. There is no built-in value. */
    readonly sealingKey: Uint8Array;
    readonly exchange: (code: string) => Promise<TokenGrant | null>;
    readonly nonce: () => string;
    readonly now: () => number;
}

/**
 * The browser's own markers for a top-level document navigation. Script cannot set them, which
 * is what makes them the header invariant 4 asks for on an endpoint reached by a navigation.
 */
export function isNavigation(request: Request): boolean {
    return (
        request.headers.get("sec-fetch-mode") === "navigate" &&
        request.headers.get("sec-fetch-dest") === "document"
    );
}

/**
 * The reader's session, when the browser marked this request a navigation and the cookie it
 * carried is one this instance sealed and has not run out. Anything else is no session at all.
 */
export function sessionOf(request: Request, auth: AuthDependencies): SessionValue | null {
    if (!isNavigation(request)) return null;

    const sealed = cookieFrom(request.headers.get("cookie"), SESSION_COOKIE);
    if (sealed === null) return null;

    const session = open<SessionValue>(auth.sealingKey, sealed);
    if (session === null || typeof session.token !== "string") return null;
    return session.expiresAt > auth.now() ? session : null;
}

/**
 * Sends the reader to GitHub, having first put the already-parsed address and a fresh random
 * value somewhere only this browser carries it. Nothing about the address travels in the value
 * GitHub echoes back.
 */
export function beginSignIn(address: PinnedAddress, auth: AuthDependencies): Response {
    const nonce = auth.nonce();
    const flow: FlowValue = { ...address, nonce };

    const authorize = new URL(AUTHORIZE);
    authorize.searchParams.set("client_id", auth.clientId);
    authorize.searchParams.set("state", nonce);

    return redirect(authorize.toString(), [
        sealedCookie(FLOW_COOKIE, seal(auth.sealingKey, flow), FLOW_SECONDS),
    ]);
}

/**
 * The endpoint GitHub returns the reader to. It builds the address it sends them on to itself,
 * from the parts it parsed before the flow began; it takes no address from a request.
 */
export async function completeSignIn(
    request: Request,
    auth: AuthDependencies,
): Promise<Response> {
    if (!isNavigation(request)) return refuse("not-a-navigation");

    const parameters = new URL(request.url).searchParams;
    const sealed = cookieFrom(request.headers.get("cookie"), FLOW_COOKIE);
    const flow = sealed === null ? null : open<FlowValue>(auth.sealingKey, sealed);
    const code = parameters.get("code");

    if (flow === null || code === null) return refused("sign-in-not-begun");
    if (parameters.get("state") !== flow.nonce) return refused("sign-in-not-begun");

    const grant = await auth.exchange(code);
    if (grant === null) return refused("sign-in-unavailable");

    const session: SessionValue = {
        token: grant.token,
        expiresAt: auth.now() + grant.expiresInSeconds * 1000,
    };

    return redirect(contentAddress(flow), [
        sealedCookie(SESSION_COOKIE, seal(auth.sealingKey, session), grant.expiresInSeconds),
        cleared(FLOW_COOKIE),
    ]);
}

/** A refusal that also ends the flow, so a half-finished sign-in leaves nothing behind. */
function refused(kind: RefusalKind): Response {
    const base = refuse(kind);
    const headers = new Headers(base.headers);
    headers.append("set-cookie", cleared(FLOW_COOKIE));
    return new Response(base.body, { status: base.status, headers });
}

/**
 * The renderer's own content endpoint, named relatively so the handler still builds no absolute
 * address of its own and is correct at whatever address it is reached at (invariant 9).
 */
function contentAddress({ store, commit, path }: FlowValue): string {
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    return `/?url=${encodeURIComponent(`https://github.com/${store}/blob/${commit}/${encoded}`)}`;
}

function redirect(location: string, cookies: readonly string[]): Response {
    const headers = new Headers({ location, "cache-control": "no-store" });
    for (const cookie of cookies) headers.append("set-cookie", cookie);
    return new Response(null, { status: 302, headers });
}
