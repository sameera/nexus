import { defineConfig } from "vitest/config";

// Split out from vite.config.ts (Story 1): the RR8 Vite-plugin swap changes
// the config Nx reads to infer this app's targets, so the Vitest test config
// is kept in its own file to leave `@nx/vitest`'s test-target inference intact.
export default defineConfig({
    root: import.meta.dirname,
    cacheDir: "../../node_modules/.vite/apps/prime",
    test: {
        name: "prime",
        watch: false,
        globals: true,
        environment: "jsdom",
        setupFiles: ["./test-setup.ts"],
        include: [
            "{app,server}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
        ],
        reporters: ["default"],
        coverage: {
            reportsDirectory: "./test-output/vitest/coverage",
            provider: "v8" as const,
        },
    },
});
