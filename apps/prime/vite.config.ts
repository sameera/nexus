import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig({
    root: import.meta.dirname,
    cacheDir: "../../node_modules/.vite/apps/prime",
    server: {
        port: 4200,
        host: "localhost",
    },
    plugins: [reactRouter()],
    build: {
        reportCompressedSize: true,
        commonjsOptions: {
            transformMixedEsModules: true,
        },
    },
    environments: {
        ssr: {
            build: {
                rollupOptions: {
                    input: "./server/app.ts",
                },
            },
        },
    },
});
