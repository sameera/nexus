import { defineConfig } from "vitest/config";

export default defineConfig({
    root: import.meta.dirname,
    cacheDir: "../../node_modules/.vite/libs/prose-verify",
    test: {
        name: "prose-verify",
        watch: false,
        globals: true,
        environment: "node",
        maxWorkers: process.platform === "win32" ? 2 : undefined,
        testTimeout: process.platform === "win32" ? 60000 : 5000,
        hookTimeout: process.platform === "win32" ? 60000 : 10000,
        include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}"],
        reporters: ["default"],
        coverage: {
            reportsDirectory: "./test-output/vitest/coverage",
            provider: "v8" as const,
        },
    },
});
