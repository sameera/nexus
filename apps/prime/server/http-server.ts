import { createServer } from "node:http";
import type { RequestListener, Server } from "node:http";
import { WebSocketServer } from "ws";

/*
 * Wraps a request listener in a plain Node HTTP server that this app owns
 * outright, leaving the `upgrade` event free — the seam issue #11 (PTY
 * Bridge) mounts its real WebSocket endpoint on. `@react-router/serve` owns
 * its own server and never exposes this event, which is the whole reason a
 * custom server exists here (see decision record).
 */
export function createAppServer(requestListener: RequestListener): Server {
    return createServer(requestListener);
}

/*
 * Attaches a stub upgrade handler proving the seam is reachable end-to-end
 * (regression-guarded by http-server.spec.ts). Issue #11 replaces this stub
 * with the real PTY Bridge endpoint; nothing about the request-handling path
 * above it changes when it does.
 */
export function attachStubUpgradeHandler(server: Server): WebSocketServer {
    const wss = new WebSocketServer({ noServer: true });
    server.on("upgrade", (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, request);
        });
    });
    return wss;
}
