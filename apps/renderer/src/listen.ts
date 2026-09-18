/**
 * The thin local listener: a separate entry point whose only job is to call the handler. It
 * is what the renderer is demonstrated against, and it is not on the handler artifact's
 * required path.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { handleRequest, type HandlerDependencies } from "./handler.js";

export interface Listener {
    readonly url: string;
    close(): Promise<void>;
}

export interface ListenerOptions extends HandlerDependencies {
    readonly host?: string;
    readonly port?: number;
}

export async function startListener(options: ListenerOptions): Promise<Listener> {
    const { host = "127.0.0.1", port = 0 } = options;
    const server = createServer((request, response) => {
        void answer(request, response, options);
    });

    await new Promise<void>((resolve) => server.listen(port, host, resolve));
    return { url: boundUrl(server, host), close: () => closed(server) };
}

async function answer(
    request: IncomingMessage,
    response: ServerResponse,
    dependencies: HandlerDependencies,
): Promise<void> {
    // The listener names the handler's request; the handler reads no hostname of its own
    // out of it, so this placeholder host is never part of an answer.
    const answered = await handleRequest(
        new Request(new URL(request.url ?? "/", "http://renderer.invalid"), {
            method: "GET",
            headers: new Headers(request.headers as Record<string, string>),
        }),
        dependencies,
    );

    response.writeHead(answered.status, Object.fromEntries(answered.headers));
    response.end(Buffer.from(await answered.arrayBuffer()));
}

function boundUrl(server: Server, host: string): string {
    const bound = server.address();
    const port = typeof bound === "object" && bound !== null ? bound.port : 0;
    return `http://${host}:${port}/`;
}

function closed(server: Server): Promise<void> {
    return new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
    );
}
