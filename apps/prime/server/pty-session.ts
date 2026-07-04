import type { IPty } from "node-pty";
import type { WebSocket } from "ws";

const activeSessions = new Set<object>();

export function getActiveSessionCount(): number {
    return activeSessions.size;
}

export function createPtySession(ws: WebSocket, ptyProcess: IPty): void {
    const token = {};
    activeSessions.add(token);
    let disposed = false;

    const dataSubscription = ptyProcess.onData((chunk) => {
        // node-pty's typings claim IEvent<string>, but with `encoding: null` (required for
        // byte-for-byte fidelity) the runtime value is a Buffer, not a string.
        const buf = chunk as unknown as Buffer;
        if (ws.readyState === ws.OPEN) {
            ws.send(buf);
        }
    });

    const exitSubscription = ptyProcess.onExit(({ exitCode, signal }) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: "exit", exitCode, signal }));
        }
        dispose();
    });

    function dispose(): void {
        if (disposed) return;
        disposed = true;
        activeSessions.delete(token);
        dataSubscription.dispose();
        exitSubscription.dispose();
        try {
            ptyProcess.kill();
        } catch {
            // already dead
        }
        ws.removeAllListeners();
        if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
            ws.close();
        }
    }

    ws.on("message", (data, isBinary) => {
        if (isBinary) {
            ptyProcess.write(data as Buffer);
        } else {
            handleControlMessage(data.toString(), ptyProcess);
        }
    });

    ws.on("close", dispose);
    ws.on("error", dispose);
}

function handleControlMessage(text: string, ptyProcess: IPty): void {
    let message: unknown;
    try {
        message = JSON.parse(text);
    } catch {
        return;
    }
    if (
        typeof message === "object" &&
        message !== null &&
        (message as { type?: unknown }).type === "resize"
    ) {
        const { cols, rows } = message as { cols: number; rows: number };
        ptyProcess.resize(cols, rows);
    }
}
