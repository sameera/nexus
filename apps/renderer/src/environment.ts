/**
 * What an instance takes from its environment: everything the handler needs, assembled in one
 * place so the listener a developer runs and the deployed function are given the same instance.
 * The environment is handed in rather than read, so this is exercisable without a process.
 */
import { randomUUID } from "node:crypto";

import { authFromEnvironment, configFromEnvironment } from "./config.js";
import { tokenExchange } from "./exchange.js";
import { type FetchLike, type HandlerDependencies } from "./handler.js";

export const defaultFetch: FetchLike = (input, init) => fetch(input, init);

/**
 * Throws rather than returning an instance that could not sign a reader in: an instance given
 * no sealing key must refuse to start instead of running with a value of its own (invariant 13).
 */
export function dependenciesFromEnvironment(
    env: Record<string, string | undefined>,
    fetcher: FetchLike = defaultFetch,
): HandlerDependencies {
    const { clientId, clientSecret, sealingKey } = authFromEnvironment(env);

    return {
        config: configFromEnvironment(env),
        fetch: fetcher,
        auth: {
            clientId,
            sealingKey,
            exchange: tokenExchange(fetcher, clientId, clientSecret),
            nonce: () => randomUUID(),
            now: () => Date.now(),
        },
    };
}
