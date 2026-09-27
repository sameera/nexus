import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { recordSections } from '@nexus/scope-razor/record';
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
    expect(draft).toContain('For the default template, verify it keeps the approval-first section order');
    expect(draft).toMatch(/reader who skips\s+the appendix can locate blockers, pending amendments, accepted costs, and guarantees/);
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
    expect(approval).toContain('before rendering the checkpoint');
    expect(approval).toMatch(/Show each offered line for an explicit keep-or-cut decision/);
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

  it('carries new guarantees and old invariants through every generated later stage', () => {
    const analyze = skill('nxs-analyze');
    const close = skill('nxs-close');
    const distill = skill('nxs-distill');
    const newBody = fs.readFileSync(
      path.join(repo, 'libs/scope-razor/src/__fixtures__/record-new.labelled.md'),
      'utf8',
    );
    const oldBody = fs.readFileSync(
      path.join(repo, 'libs/scope-razor/src/__fixtures__/record-old.filed.md'),
      'utf8',
    );

    for (const stage of [analyze, close, distill]) {
      expect(stage).toContain('nexus record-sections --body');
      expect(stage).toMatch(/`new`/);
      expect(stage).toMatch(/`old`/);
    }
    expect(recordSections(newBody).guarantees.map((g) => g.id)).toEqual([
      'G1', 'G2', 'G3', 'G4', 'G5',
    ]);
    expect(recordSections(newBody).decisions.map((d) => d.id)).toEqual([
      'D1', 'D2', 'D3',
    ]);
    expect(recordSections(oldBody).format).toBe('old');
    expect(recordSections(oldBody).invariants).toHaveLength(16);
    expect(analyze).toMatch(/broken.+guarantee.+\*\*critical\*\*/is);
    expect(analyze).toMatch(/check every guarantee returned by `nexus record-sections --body` by\s+its ID/);
    expect(analyze).toContain('Guarantee violations:   <G<n>');
    expect(close).toContain('nexus record-digest');
    expect(close).toContain('A non-zero section-reader exit stops close');
    expect(close).toMatch(/carry every `decisions` entry and `guarantees` entry by ID/);
    expect(distill).toContain('record_hash');
    expect(distill).toMatch(/A non-zero\s+section-reader exit stops distill/);
    expect(distill).toMatch(/For `new`, carry\s+How it works, Mechanism, decisions and reasons, and guarantees/);
    expect(distill).toMatch(/For `old`, carry the chosen approach, Key Decisions and constraints\/invariants/);
    expect(distill).toMatch(/Hashes differ.+hard-error/s);
  });
});
