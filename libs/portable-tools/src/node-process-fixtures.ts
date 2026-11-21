/** Test-only adapter: Node gh stand-ins are scripts, and Windows does not execute shebangs. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Runner } from '@nexus/workspace/run';

/** Keep subprocess output deterministic when Nx forces colors and tsx disables them. */
export function plainProcessEnvironment(overrides?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env, ...overrides, NO_COLOR: '1' };
    delete env['FORCE_COLOR'];
    return env;
}

export function nodeFixtureRunner(fallback: Runner, envPath?: string, platform: NodeJS.Platform = process.platform): Runner {
    return (command, args, opts) => {
        if (platform === 'win32' && command === 'gh') {
            for (const dir of (envPath ?? process.env['PATH'] ?? '').split(';').filter(Boolean)) {
                const script = path.join(dir, 'gh');
                if (!fs.existsSync(script) || !fs.statSync(script).isFile()) continue;
                if (!fs.readFileSync(script, 'utf8').startsWith('#!/usr/bin/env node')) continue;
                const result = spawnSync(process.execPath, [script, ...args], {cwd: opts.cwd, input: opts.input, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024});
                return {status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? result.error?.message ?? ''};
            }
        }
        return fallback(command, args, opts);
    };
}
