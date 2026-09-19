import { defineConfig } from "vitest/config";

export default defineConfig({
    root: import.meta.dirname,
    cacheDir: "../../node_modules/.vite/libs/teaching",
    test: {
        name: "teaching",
        watch: false,
        globals: true,
        environment: "node",
        // The workbook render specs parse real HTML through jsdom and the CLI specs spawn real
        // subprocesses — slower than pure unit tests and prone to spurious timeouts under the
        // parallel contention of `nx run-many -t test` across every project at once.
        testTimeout: 20000,
        include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}"],
        reporters: ["default"],
        coverage: {
            reportsDirectory: "./test-output/vitest/coverage",
            provider: "v8" as const,
        },
    },
});
