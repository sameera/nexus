/**
 * The renderer's configuration, handed to an instance by its environment when it starts
 * rather than built into the artifact (decision record #653): changing which stores are
 * served must not require building and shipping a new one.
 */
export interface RendererConfig {
    /** The stores this instance serves, as `owner/repo`. Anything else is refused. */
    readonly stores: readonly string[];
    /** The largest file this instance will serve, in bytes. */
    readonly sizeCap: number;
}

/** Where the local listener binds when the team designates nothing. */
export const DEFAULT_ADDRESS: ListenerAddress = { host: "127.0.0.1", port: 8787 };

/** The size cap an instance uses when its environment names none. */
export const DEFAULT_SIZE_CAP = 5_242_880;

/**
 * What an instance needs before it can sign a reader in. The sealing key has no built-in
 * value and no fallback: an instance given none refuses to start rather than running with a
 * default that would make every session forgeable (invariant 13).
 */
export interface AuthSettings {
    readonly clientId: string;
    readonly clientSecret: string;
    readonly sealingKey: Uint8Array;
}

const SEALING_KEY_BYTES = 32;

export function authFromEnvironment(env: Record<string, string | undefined>): AuthSettings {
    const clientId = (env.NEXUS_RENDERER_CLIENT_ID ?? "").trim();
    const clientSecret = (env.NEXUS_RENDERER_CLIENT_SECRET ?? "").trim();
    const declared = (env.NEXUS_RENDERER_SESSION_KEY ?? "").trim();

    if (clientId.length === 0) throw new Error("NEXUS_RENDERER_CLIENT_ID names no GitHub App.");
    if (clientSecret.length === 0) {
        throw new Error("NEXUS_RENDERER_CLIENT_SECRET names no GitHub App secret.");
    }

    const sealingKey = new Uint8Array(Buffer.from(declared, "base64"));
    if (declared.length === 0 || sealingKey.length !== SEALING_KEY_BYTES) {
        throw new Error(
            `NEXUS_RENDERER_SESSION_KEY must be ${SEALING_KEY_BYTES} bytes, base64-encoded.`,
        );
    }

    return { clientId, clientSecret, sealingKey };
}

export interface ListenerAddress {
    readonly host: string;
    readonly port: number;
}

/**
 * The address the team designates for the local listener. The handler never reads a hostname
 * of its own — this binds the listener, and nothing else.
 */
export function addressFromEnvironment(
    env: Record<string, string | undefined>,
): ListenerAddress {
    const designated = (env.NEXUS_RENDERER_ADDRESS ?? "").trim();
    if (designated.length === 0) return DEFAULT_ADDRESS;

    const separator = designated.lastIndexOf(":");
    const host = separator === -1 ? designated : designated.slice(0, separator);
    const port = separator === -1 ? undefined : designated.slice(separator + 1);

    return {
        host: host.length > 0 ? host : DEFAULT_ADDRESS.host,
        port: positiveInteger(port) ?? DEFAULT_ADDRESS.port,
    };
}

export function configFromEnvironment(env: Record<string, string | undefined>): RendererConfig {
    return {
        stores: (env.NEXUS_RENDERER_STORES ?? "")
            .split(",")
            .map((store) => store.trim())
            .filter((store) => store.length > 0),
        sizeCap: positiveInteger(env.NEXUS_RENDERER_SIZE_CAP) ?? DEFAULT_SIZE_CAP,
    };
}

function positiveInteger(value: string | undefined): number | undefined {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) return undefined;
    return parsed;
}
