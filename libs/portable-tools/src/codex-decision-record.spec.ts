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

  it('checks live amendments and offers the complete labelled draft before filing', () => {
    const approval = skill('nxs-decision-record');

    expect(approval).toContain('nexus record-amendments --draft');
    expect(approval).toMatch(/pending.+list the change \*\*first\*\* under "Resolve before approval"/s);
    expect(approval).toContain('nexus razor-check --draft "<scratch>/record-body.labelled.md" --source "<scratch>/source.md" --record');
    expect(approval).toMatch(/A non-zero exit stops the run before the cut list is rendered: file nothing/);
    expect(approval).toContain('nexus razor-offer --draft "<scratch>/record-body.labelled.md" --record');
    expect(approval).toMatch(/every refuted alternative, and every guarantee and every risk the model added/);
    expect(approval).toContain('"Existing behaviour to preserve" included');
    expect(approval).toMatch(/A new-format record keeps its numbers/);
    expect(approval).toMatch(/--cut "G3,R2"/);
    expect(approval).toMatch(/A non-zero exit stops the run: file nothing/);
    expect(approval).toMatch(/complete decision surface and choices in the same final response/);
  });
});
