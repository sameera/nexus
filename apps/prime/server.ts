import express from "express";
import { createAppServer } from "./server/http-server";
import { attachPtyBridgeHandler } from "./server/pty-bridge";

/*
 * Dev-vs-prod strategy: dev and prod share this one entry point. Dev runs
 * Vite in middleware mode (not the RR8 CLI dev server) so the PTY bridge
 * below is exercised in the daily inner loop, not only in a rare prod
 * smoke-test — the decision record's load-bearing reason. Prod imports the
 * built server bundle instead. Both funnel through the same
 * `createAppServer` + `attachPtyBridgeHandler`, so the endpoint is identical
 * either way.
 */

const BUILD_PATH = "./build/server/index.js";
const DEVELOPMENT = process.env.NODE_ENV === "development";
const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);

const app = express();
app.disable("x-powered-by");

// Chrome DevTools "automatic workspace folders" probe — answer quietly so it
// does not fall through to the RR8 handler and log a spurious 404 each start.
app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
    res.status(204).end();
});

if (DEVELOPMENT) {
    console.log("Starting development server");
    const { createServer: createViteServer } = await import("vite");
    const viteDevServer = await createViteServer({
        server: { middlewareMode: true },
    });
    app.use(viteDevServer.middlewares);
    app.use(async (req, res, next) => {
        try {
            const source = await viteDevServer.ssrLoadModule("./server/app.ts");
            return await source.app(req, res, next);
        } catch (error) {
            if (error instanceof Error) {
                viteDevServer.ssrFixStacktrace(error);
            }
            next(error);
        }
    });
} else {
    console.log("Starting production server");
    app.use(
        "/assets",
        express.static("build/client/assets", {
            immutable: true,
            maxAge: "1y",
        }),
    );
    app.use(express.static("build/client", { maxAge: "1h" }));
    const built = await import(BUILD_PATH);
    app.use(built.app);
}

const httpServer = createAppServer(app);
attachPtyBridgeHandler(httpServer);

httpServer.listen(PORT, () => {
    console.log(`Prime server listening on http://localhost:${PORT}`);
});
