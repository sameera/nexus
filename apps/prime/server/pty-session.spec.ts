import type { IPty } from "node-pty";
import type { WebSocket } from "ws";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPtySession, getActiveSessionCount } from "./pty-session";

type Listener = (...args: unknown[]) => void;

function createFakePty() {
    const dataListeners: ((d: Buffer) => void)[] = [];
    const exitListeners: ((e: { exitCode: number; signal?: number }) => void)[] = [];
    return {
        pid: 4242,
        onData: vi.fn((listener: (d: Buffer) => void) => {
            dataListeners.push(listener);
            return {
                dispose: vi.fn(() => {
                    const idx = dataListeners.indexOf(listener);
                    if (idx >= 0) dataListeners.splice(idx, 1);
                }),
            };
        }),
        onExit: vi.fn((listener: (e: { exitCode: number; signal?: number }) => void) => {
            exitListeners.push(listener);
            return {
                dispose: vi.fn(() => {
                    const idx = exitListeners.indexOf(listener);
                    if (idx >= 0) exitListeners.splice(idx, 1);
                }),
            };
        }),
        resize: vi.fn(),
        write: vi.fn(),
        kill: vi.fn(),
        emitData(buf: Buffer) {
            for (const listener of [...dataListeners]) listener(buf);
        },
        emitExit(e: { exitCode: number; signal?: number }) {
            for (const listener of [...exitListeners]) listener(e);
        },
    };
}

function createFakeWs() {
    const listeners: Record<string, Listener[]> = {};
    const ws = {
        OPEN: 1,
        CONNECTING: 0,
        readyState: 1,
        send: vi.fn(),
        close: vi.fn(() => {
            ws.readyState = 3;
        }),
        on: vi.fn((event: string, listener: Listener) => {
            (listeners[event] ??= []).push(listener);
            return ws;
        }),
        removeAllListeners: vi.fn(() => {
            for (const key of Object.keys(listeners)) delete listeners[key];
            return ws;
        }),
        emit(event: string, ...args: unknown[]) {
            // Mirrors real `ws`: readyState is already CLOSED by the time the "close" event fires.
            if (event === "close") ws.readyState = 3;
            for (const listener of [...(listeners[event] ?? [])]) listener(...args);
        },
    };
    return ws;
}

type FakePty = ReturnType<typeof createFakePty>;
type FakeWs = ReturnType<typeof createFakeWs>;

describe("createPtySession", () => {
    let pty: FakePty;
    let ws: FakeWs;

    beforeEach(() => {
        pty = createFakePty();
        ws = createFakeWs();
    });

    it("registers the session on creation and removes it on socket close", () => {
        expect(getActiveSessionCount()).toBe(0);
        createPtySession(ws as unknown as WebSocket, pty as unknown as IPty);
        expect(getActiveSessionCount()).toBe(1);

        ws.emit("close");

        expect(getActiveSessionCount()).toBe(0);
    });

    it("kills the PTY when the socket closes", () => {
        createPtySession(ws as unknown as WebSocket, pty as unknown as IPty);
        ws.emit("close");
        expect(pty.kill).toHaveBeenCalledTimes(1);
    });

    it("closes the socket when the PTY exits on its own", () => {
        createPtySession(ws as unknown as WebSocket, pty as unknown as IPty);
        pty.emitExit({ exitCode: 0 });
        expect(ws.close).toHaveBeenCalledTimes(1);
        expect(getActiveSessionCount()).toBe(0);
    });

    it("sends an exit notice before closing the socket on PTY self-exit", () => {
        createPtySession(ws as unknown as WebSocket, pty as unknown as IPty);
        pty.emitExit({ exitCode: 0 });
        const jsonSends = ws.send.mock.calls.filter((call) => typeof call[0] === "string");
        expect(jsonSends.length).toBeGreaterThan(0);
        expect(JSON.parse(jsonSends[0][0] as string)).toMatchObject({ type: "exit" });
    });

    it("is idempotent when the socket closes first, then the PTY exits", () => {
        createPtySession(ws as unknown as WebSocket, pty as unknown as IPty);
        ws.emit("close");
        pty.emitExit({ exitCode: 0 });
        expect(pty.kill).toHaveBeenCalledTimes(1);
        expect(ws.close).toHaveBeenCalledTimes(0); // socket was already closing, never asked to close itself
        expect(getActiveSessionCount()).toBe(0);
    });

    it("is idempotent when the PTY exits first, then the socket closes", () => {
        createPtySession(ws as unknown as WebSocket, pty as unknown as IPty);
        pty.emitExit({ exitCode: 0 });
        ws.emit("close");
        expect(pty.kill).toHaveBeenCalledTimes(1);
        expect(ws.close).toHaveBeenCalledTimes(1);
        expect(getActiveSessionCount()).toBe(0);
    });

    it("removes listeners on dispose so later events are no-ops", () => {
        createPtySession(ws as unknown as WebSocket, pty as unknown as IPty);
        ws.emit("close");
        ws.send.mockClear();
        pty.write.mockClear();

        pty.emitData(Buffer.from("late data"));
        ws.emit("message", Buffer.from("late input"), true);

        expect(ws.send).not.toHaveBeenCalled();
        expect(pty.write).not.toHaveBeenCalled();
    });

    it("writes binary ws messages to the pty verbatim", () => {
        createPtySession(ws as unknown as WebSocket, pty as unknown as IPty);
        const input = Buffer.from("ls -la\r");
        ws.emit("message", input, true);
        expect(pty.write).toHaveBeenCalledWith(input);
        ws.emit("close");
    });

    it("streams pty output to the socket as binary", () => {
        createPtySession(ws as unknown as WebSocket, pty as unknown as IPty);
        const output = Buffer.from("total 0\n");
        pty.emitData(output);
        expect(ws.send).toHaveBeenCalledWith(output);
        ws.emit("close");
    });

    it("resizes the pty on a resize control message", () => {
        createPtySession(ws as unknown as WebSocket, pty as unknown as IPty);
        ws.emit("message", JSON.stringify({ type: "resize", cols: 120, rows: 40 }), false);
        expect(pty.resize).toHaveBeenCalledWith(120, 40);
        ws.emit("close");
    });

    it("ignores malformed control messages without throwing", () => {
        createPtySession(ws as unknown as WebSocket, pty as unknown as IPty);
        expect(() => ws.emit("message", "not json", false)).not.toThrow();
        expect(pty.resize).not.toHaveBeenCalled();
        ws.emit("close");
    });
});
