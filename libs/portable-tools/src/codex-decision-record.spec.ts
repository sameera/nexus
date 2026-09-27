import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderCodexComponents } from './codex-components';
import { authoredComponentRoot } from './vendor-components';

const repo = path.resolve(import.meta.dirname, '../../..');
const generated = renderCodexComponents(authoredComponentRoot(import.meta.dirname));

function skill(name: string): string {
  const body = generated.get(`skills/${name}/SKILL.md`);
  if (!body) throw new Error(`missing Codex skill: ${name}`);
  return body.toString();
}

describe('Codex decision-record pipeline', () => {
  it('drafts from the shared approval-first template and keeps the full rationale behind the brief', () => {
    const draft = skill('nxs-decision-record');
    const template = fs.readFileSync(
      path.join(repo, 'common/templates/decision-record-template.md'),
      'utf8',
    );
    const headings = [...template.matchAll(/^## (.+)$/gm)].map((match) => match[1]);

    expect(headings).toEqual([
      'How it works',
      'Approval brief',
      'Guarantees',
      'Risks and dependencies',
      'Concept-store changes',
      'Design rationale and mechanism',
    ]);
    expect(draft).toContain('.nexus/config/templates/decision-record-template.md');
    expect(draft).toMatch(/How it works.+epic's vocabulary/s);
    expect(draft).toMatch(/every decision whose trade-off is not `none`/);
    expect(draft).toMatch(/Every decision with a trade-off appears in the brief exactly once/);
    expect(draft).toMatch(/appendix.+Decision, Why, Refuted viable alternative/s);
    expect(draft).toMatch(/Resolve before approval.+BLOCKER risk/s);
    expect(draft).toMatch(/Before implementation.+ADDRESS risk/s);
  });
});
