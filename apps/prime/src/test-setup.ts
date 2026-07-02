// Registers @testing-library/jest-dom's custom matchers (e.g. toHaveAttribute,
// toBeVisible) on Vitest's `expect` and augments its matcher types. Wired into
// the test run via `test.setupFiles` in vite.config.mts.
import "@testing-library/jest-dom/vitest";
