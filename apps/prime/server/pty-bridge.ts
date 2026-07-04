import type { Server } from "node:http";
import * as pty from "node-pty";
import { WebSocketServer } from "ws";
import { isOriginAllowed } from "./pty-origin-guard";
import { resolveShell } from "./pty-shell-resolve";
import { createPtySession } from "./pty-session";

const PTY_BRIDGE_PATH = "/pty";

export function attachPtyBridgeHandler(server: Server): WebSocketServer {
    const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

    server.on("upgrade", (request, socket, head) => {
        const pathname = (request.url ?? "").split("?")[0];
        if (pathname !== PTY_BRIDGE_PATH) {
            socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
            socket.destroy();
            return;
        }

        if (!isOriginAllowed(request.headers.host, request.headers.origin)) {
            socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
            socket.destroy();
            return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, request);
        });
    });

    wss.on("connection", (ws) => {
        const { file, args } = resolveShell();
        const ptyProcess = pty.spawn(file, args, {
            name: "xterm-256color",
            cols: 80,
            rows: 24,
            cwd: process.env.HOME,
            env: process.env as Record<string, string>,
            encoding: null,
        });
        createPtySession(ws, ptyProcess);
    });

    return wss;
}
