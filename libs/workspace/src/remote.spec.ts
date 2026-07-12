import { describe, expect, it } from "vitest";
import { normalizeRemote } from "./remote";

describe("normalizeRemote", () => {
    it("normalizes the three equivalent spellings of one remote to the same value", () => {
        const scp = normalizeRemote("git@github.com:acme/web-app.git");
        const https = normalizeRemote("https://github.com/acme/web-app");
        const ssh = normalizeRemote("ssh://git@github.com/acme/web-app.git");

        expect(scp).toBe("github.com/acme/web-app");
        expect(https).toBe(scp);
        expect(ssh).toBe(scp);
    });

    it("strips a trailing .git suffix", () => {
        expect(normalizeRemote("https://github.com/acme/web-app.git")).toBe(
            "github.com/acme/web-app",
        );
    });

    it("strips a trailing slash", () => {
        expect(normalizeRemote("https://github.com/acme/web-app/")).toBe(
            "github.com/acme/web-app",
        );
    });

    it("lowercases the host but preserves the path's case", () => {
        expect(normalizeRemote("git@GitHub.COM:Acme/Web-App.git")).toBe(
            "github.com/Acme/Web-App",
        );
    });

    it("ignores an ssh:// port", () => {
        expect(normalizeRemote("ssh://git@github.com:22/acme/web-app.git")).toBe(
            "github.com/acme/web-app",
        );
    });

    it("accepts an already-normalized bare host/path form", () => {
        expect(normalizeRemote("github.com/acme/web-app")).toBe("github.com/acme/web-app");
    });

    it("supports self-hosted hosts and nested groups", () => {
        expect(normalizeRemote("git@gitlab.example.com:group/sub/proj.git")).toBe(
            "gitlab.example.com/group/sub/proj",
        );
    });

    it("handles a host with no path", () => {
        expect(normalizeRemote("github.com")).toBe("github.com");
        expect(normalizeRemote("https://github.com")).toBe("github.com");
    });

    it("is idempotent", () => {
        for (const raw of [
            "git@github.com:acme/web-app.git",
            "https://github.com/acme/web-app",
            "ssh://git@github.com:22/acme/web-app.git",
            "github.com/acme/web-app",
        ]) {
            const once = normalizeRemote(raw);
            expect(normalizeRemote(once)).toBe(once);
        }
    });

    it("trims surrounding whitespace", () => {
        expect(normalizeRemote("  https://github.com/acme/web-app.git  ")).toBe(
            "github.com/acme/web-app",
        );
    });
});
