import { existsSync } from "node:fs";

export interface ResolvedShell {
    file: string;
    args: string[];
}

const LOGIN_SHELL_ARGS = ["-l"];

export function resolveShell(
    env: NodeJS.ProcessEnv = process.env,
    exists: (path: string) => boolean = existsSync,
): ResolvedShell {
    const file = env.PRIME_SHELL || env.SHELL || (exists("/bin/bash") ? "/bin/bash" : "/bin/sh");
    return { file, args: LOGIN_SHELL_ARGS };
}
