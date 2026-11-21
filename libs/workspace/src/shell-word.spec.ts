import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { shellWord } from './shell-word';

it.skipIf(process.platform !== 'win32')('keeps copied PowerShell remedy arguments literal', () => {
    const value = "C:\\My Repo\\Sam's $data & notes\\epic.md";
    const script = `$value = ${shellWord(value)}; [Console]::Write($value)`;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {encoding: 'utf8'});
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(value);
});

it('retains POSIX quoting and uses PowerShell escaping for apostrophes on Windows', () => {
    expect(shellWord("Sam's repo", 'win32')).toBe("'Sam''s repo'");
    expect(shellWord("Sam's repo", 'linux')).toBe("'Sam'\\''s repo'");
    expect(shellWord('acme/repo', 'win32')).toBe('acme/repo');
});
