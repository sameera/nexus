import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, it } from 'vitest';
import { checkDraft } from './check';
import { deriveFilingBody } from './labels';
import { recordChecklist } from './record-offer';
import { checklist } from './offer';

const record = fs.readFileSync(path.join(import.meta.dirname, '__fixtures__/record-new.labelled.md'), 'utf8').replace(/\r\n/g, '\n');
const epic = '# Epic: Search\n\n## Stories\n\n### Search\n\n- Value: Find records `[asked: "Find records"]`\n\n#### Acceptance Criteria\n\n- [ ] Find records `[asked: "Find records"]`\n';

it.each([['record', record, true], ['epic', epic, false]] as const)('keeps the %s approval checks and filing body identical for CRLF input', (_name, lf, isRecord) => {
  const crlf = lf.replace(/\n/g, '\r\n');
  expect(checkDraft(crlf, 'Find records', { record: isRecord })).toEqual(checkDraft(lf, 'Find records', { record: isRecord }));
  expect(isRecord ? recordChecklist(crlf) : checklist(crlf)).toEqual(isRecord ? recordChecklist(lf) : checklist(lf));
  expect(deriveFilingBody(crlf)).toBe(deriveFilingBody(lf));
});
