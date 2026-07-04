import { describe, expect, it } from "vitest";
import { resolveShell } from "./pty-shell-resolve";

describe("resolveShell", () => {
    it("prefers PRIME_SHELL over SHELL", () => {
        const env = { PRIME_SHELL: "/opt/shells/fish", SHELL: "/bin/zsh" };
        expect(resolveShell(env)).toEqual({ file: "/opt/shells/fish", args: ["-l"] });
    });

    it("falls back to SHELL when PRIME_SHELL is unset", () => {
        const env = { SHELL: "/bin/zsh" };
        expect(resolveShell(env)).toEqual({ file: "/bin/zsh", args: ["-l"] });
    });

    it("falls back to /bin/bash when neither is set and bash exists", () => {
        const exists = (path: string) => path === "/bin/bash";
        expect(resolveShell({}, exists)).toEqual({ file: "/bin/bash", args: ["-l"] });
    });

    it("falls back to /bin/sh when neither is set and bash is absent", () => {
        const exists = () => false;
        expect(resolveShell({}, exists)).toEqual({ file: "/bin/sh", args: ["-l"] });
    });
});
