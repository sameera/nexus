/**
 * Trading GitHub's returned code for the reader's own token. This is the only place the
 * renderer talks to GitHub about a credential, and it is supplied to the handler rather than
 * reached for, so the sign-in flow is exercisable without a network.
 */
import { type TokenGrant } from "./auth.js";
import { type FetchLike } from "./handler.js";

const ACCESS_TOKEN = "https://github.com/login/oauth/access_token";

/** The life a user-to-server token is given when GitHub states none. */
const DEFAULT_LIFE_SECONDS = 28_800;

export function tokenExchange(
    fetcher: FetchLike,
    clientId: string,
    clientSecret: string,
): (code: string) => Promise<TokenGrant | null> {
    return async (code: string) => {
        const response = await fetcher(ACCESS_TOKEN, {
            method: "POST",
            headers: {
                accept: "application/json",
                "content-type": "application/json",
                "user-agent": "nexus-renderer",
            },
            body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
        });
        if (!response.ok) return null;

        const payload = (await response.json().catch(() => null)) as {
            access_token?: unknown;
            expires_in?: unknown;
        } | null;
        if (payload === null || typeof payload.access_token !== "string") return null;

        const life = Number(payload.expires_in);
        return {
            token: payload.access_token,
            expiresInSeconds: Number.isSafeInteger(life) && life > 0 ? life : DEFAULT_LIFE_SECONDS,
        };
    };
}
