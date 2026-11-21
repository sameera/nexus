import { defineConfig } from "vitest/config";

export default defineConfig({
    root: import.meta.dirname,
    cacheDir: "../../node_modules/.vite/libs/portable-tools",
    test: {
        name: "portable-tools",
        // These contributor-only Bash wrappers are POSIX tools. Windows uses the native CLI.
        exclude: process.platform === 'win32' ? ['src/close-epic.spec.ts'] : [],
        watch: false,
        globals: true,
        environment: "node",
        // This project's specs spawn real subprocesses (npx tsx, node, git) and build esbuild
        // bundles — inherently slower than pure unit tests, and prone to spurious timeouts under
        // the parallel contention of `nx run-many -t test` across every project at once.
        testTimeout: process.platform === 'win32' ? 60000 : 20000,
        // Windows subprocess-heavy builds contend badly when every test file starts a worker.
        maxWorkers: process.platform === 'win32' ? 2 : undefined,
        hookTimeout: 60000,
        include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}"],
        reporters: ["default"],
        coverage: {
            reportsDirectory: "./test-output/vitest/coverage",
            provider: "v8" as const,
        },
    },
});
