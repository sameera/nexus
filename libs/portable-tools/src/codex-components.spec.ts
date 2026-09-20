import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderCodexComponents } from './codex-components';

let payload: string;
beforeEach(() => {
  payload = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-render-'));
});
afterEach(() => fs.rmSync(payload, { recursive: true, force: true }));
function write(rel: string, content: string | Buffer): void {
  const target = path.join(payload, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

describe('Codex payload validation', () => {
  it('keeps a compound approval and its numbered changes in one self-contained interaction', () => {
    write(
      'commands/nxs.epic.md',
      '---\ndescription: Epic\n---\nUse AskUserQuestion for approval.\n',
    );
    const epic =
      renderCodexComponents(payload)
        .get('skills/nxs-epic/SKILL.md')
        ?.toString() ?? '';

    expect(epic).toMatch(/complete decision surface.+same final response/is);
    expect(epic).toMatch(
      /choice tool cannot collect.+number.+one answer.+normal conversation/is,
    );
    expect(epic).toMatch(/without a\s+second confirmation/i);
  });

  it('preserves relative helper resources including binary assets', () => {
    write(
      'skills/nxs-setup/SKILL.md',
      '---\ndescription: Interview\n---\nRead assets/sample.bin.\n',
    );
    const bytes = Buffer.from([0, 255, 10, 13]);
    write('skills/nxs-setup/assets/sample.bin', bytes);
    const rendered = renderCodexComponents(payload);
    expect(
      rendered.get('skills/nxs-product-context/assets/sample.bin'),
    ).toEqual(bytes);
    expect(
      rendered.get('skills/nxs-product-context/SKILL.md')?.toString(),
    ).toContain('Read assets/sample.bin.');
  });

  it('refuses colliding command and helper names instead of silently losing a workflow', () => {
    write('commands/nxs.epic.md', '---\ndescription: Epic\n---\nPlan\n');
    write('skills/nxs-epic/SKILL.md', '---\ndescription: Helper\n---\nHelp\n');
    expect(() => renderCodexComponents(payload)).toThrow(/collision/);
  });

  it.each([
    [
      'commands/Bad Name.md',
      '---\ndescription: Invalid\n---\nBody',
      /Invalid Codex skill name/,
    ],
    ['commands/nxs.epic.md', '---\nname: nxs.epic\n---\nBody', /description/],
    [
      'commands/nxs.epic.md',
      '---\ndescription: >\n  multiline\n---\nBody',
      /description/,
    ],
    ['agents/nxs-role.json', '{}', /Unsupported/],
  ])(
    'rejects unsupported metadata or components (%s)',
    (rel, content, error) => {
      write(rel as string, content as string);
      expect(() => renderCodexComponents(payload)).toThrow(error as RegExp);
    },
  );
});
