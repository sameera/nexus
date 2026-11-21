import { beforeEach, expect, it, vi } from 'vitest';
import { runNexusCli } from './nexus-cli';
import { runImplementEpic } from './implement';

vi.mock('./implement.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('./implement')>(),
    implementEpicDeps: vi.fn(() => ({})),
    runImplementEpic: vi.fn(async () => 0),
}));

beforeEach(() => vi.clearAllMocks());

async function invoke(args: string[]): Promise<void> {
    const messages: string[] = [];
    const code = await runNexusCli(['implement', '123', ...args], {
        cwd: process.cwd(), stdout: (line) => messages.push(line), stderr: (line) => messages.push(line),
    });
    expect(code, messages.join('\n')).toBe(0);
}

it.skipIf(process.platform !== 'win32')('selects Codex for an ordinary implement invocation on Windows', async () => {
    await invoke([]);
    expect(vi.mocked(runImplementEpic).mock.calls[0][1]).toMatchObject({epic: 123, harness: 'codex'});
});

it.each(['codex', 'claude'])('honors an explicit %s harness at the CLI boundary', async (harness) => {
    await invoke(['--harness', harness]);
    expect(vi.mocked(runImplementEpic).mock.calls[0][1]).toMatchObject({epic: 123, harness});
});
