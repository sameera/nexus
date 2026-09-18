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

/** The size cap an instance uses when its environment names none. */
export const DEFAULT_SIZE_CAP = 5_242_880;

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
