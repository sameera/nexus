export function isOriginAllowed(
    hostHeader: string | undefined,
    originHeader: string | undefined,
): boolean {
    if (originHeader === undefined) {
        return true;
    }
    if (hostHeader === undefined) {
        return false;
    }
    let originHost: string;
    try {
        originHost = new URL(originHeader).host;
    } catch {
        return false;
    }
    return originHost === hostHeader;
}
