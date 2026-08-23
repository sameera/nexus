import { defineConfig } from "vitest/config";

export default defineConfig({
    root: import.meta.dirname,
    cacheDir: "../../node_modules/.vite/libs/abs-doc-path",
    test: {
        name: "abs-doc-path",
        watch: false,
        globals: true,
        environment: "node",
        include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}"],
        reporters: ["default"],
        coverage: {
            reportsDirectory: "./test-output/vitest/coverage",
            provider: "v8" as const,
        },
    },
});
