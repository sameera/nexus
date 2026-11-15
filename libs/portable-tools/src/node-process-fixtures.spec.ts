import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, it } from 'vitest';
import { nodeFixtureRunner } from './node-process-fixtures';

it('runs the Node gh stand-in on Windows without relying on a Unix shebang', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gh fixture '));
    try {
        fs.writeFileSync(path.join(root, 'gh'), '#!/usr/bin/env node\nconsole.log(JSON.stringify(process.argv.slice(2)));');
        const fallback = () => ({status: 99, stdout: '', stderr: 'fallback'});
        const run = nodeFixtureRunner(fallback, root, 'win32');
        const args = ['issue', 'view', 'literal & $variable'];
        const result = run('gh', args, {cwd: root});
        expect(result.status, result.stderr).toBe(0);
        expect(JSON.parse(result.stdout)).toEqual(args);
        expect(run('git', [], {cwd: root}).status).toBe(99);
    } finally { fs.rmSync(root, {recursive: true, force: true}); }
});
