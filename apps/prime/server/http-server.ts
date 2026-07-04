import { createServer } from "node:http";
import type { RequestListener, Server } from "node:http";

/*
 * Wraps a request listener in a plain Node HTTP server that this app owns
 * outright, leaving the `upgrade` event free — the seam the PTY Bridge (issue
 * #11) mounts its real WebSocket endpoint on, via `attachPtyBridgeHandler` in
 * `./pty-bridge`. `@react-router/serve` owns its own server and never exposes
 * this event, which is the whole reason a custom server exists here (see
 * decision record).
 */
export function createAppServer(requestListener: RequestListener): Server {
    return createServer(requestListener);
}
