import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { resolveHarnessInvocation } from './harness-process';
import { spawnSession } from './distill-command';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

it('launches the Windows npm Codex entry through Node with literal arguments', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus harness '));
  roots.push(root);
  const entry = path.join(root, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  fs.mkdirSync(path.dirname(entry), { recursive: true });
  fs.writeFileSync(entry, '');
  fs.writeFileSync(path.join(root, 'codex.cmd'), '@echo off');
  const args = ['exec', '--', 'literal "$env:SECRET" & %PATH%\nsecond line'];
  expect(resolveHarnessInvocation('codex', args, root, 'win32')).toEqual({
    command: process.execPath, args: [entry, ...args],
  });
});

it('recognizes a native Windows executable without treating a directory as executable', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-native-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, 'codex.exe'));
  expect(resolveHarnessInvocation('codex', [], root, 'win32')).toBeNull();
  fs.rmdirSync(path.join(root, 'codex.exe'));
  fs.writeFileSync(path.join(root, 'codex.exe'), '');
  expect(resolveHarnessInvocation('codex', ['--version'], root, 'win32')).toEqual({command: path.join(root, 'codex.exe'), args: ['--version']});
  expect(resolveHarnessInvocation(path.join(root, 'codex.exe'), ['--version'], '', 'win32')).toEqual({command: path.join(root, 'codex.exe'), args: ['--version']});
});

it('preserves Unix executable launches and refuses a missing executable', () => {
  const args = ['--version'];
  expect(resolveHarnessInvocation(process.execPath, args, '', 'linux')).toEqual({command: process.execPath, args});
  expect(resolveHarnessInvocation(path.join(import.meta.dirname, 'no-such-harness'), args, '', 'linux')).toBeNull();
});

it.skipIf(process.platform !== 'win32')('runs a Windows npm harness with prompt metacharacters intact', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus prompt '));
  roots.push(root);
  const entry = path.join(root, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  fs.mkdirSync(path.dirname(entry), { recursive: true });
  fs.writeFileSync(entry, 'console.log(JSON.stringify({type:"item.completed",item:{type:"agent_message",text:process.argv[2]}}));');
  const prompt = 'literal "$env:SECRET" & %PATH% `whoami`\nsecond line';
  const end = await spawnSession({ command: path.join(root, 'codex.cmd'), args: [prompt], cwd: root }, () => {});
  expect(end).toMatchObject({ started: true, exitCode: 0, finalMessage: prompt });
});
