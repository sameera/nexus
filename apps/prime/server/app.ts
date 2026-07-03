import { createRequestHandler } from "@react-router/express";
import express, { type Express } from "express";

/*
 * The RR8 request handler, wrapped in a plain Express app (Story 1). This is
 * loaded two ways: via Vite's `ssrLoadModule` in dev (middleware mode, so it
 * gets the same live route graph as HMR), and bundled as the SSR build entry
 * in prod (see `environments.ssr.build.rollupOptions.input` in vite.config.ts).
 * Either way it is mounted into the custom server (`server.ts`) that owns the
 * underlying `http.Server` — see `server/http-server.ts` for why.
 */
export const app: Express = express();

app.use(
    createRequestHandler({
        build: () => import("virtual:react-router/server-build"),
    }),
);
