import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runNexusCli, type CliIo } from './nexus-cli';
import { detectEnvironmentDefects } from './environment-guard';
import { INSTALL_LEDGER_FILE } from './deploy-components';
import {
  authoredComponentRoot,
  checkoutComponentRoot,
  listComponentFiles,
} from './vendor-components';

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, homedir: vi.fn(actual.homedir) };
});

let root: string;
let home: string;
let cwd: string;
let out: string[];
let err: string[];
let io: CliIo;
const authored = authoredComponentRoot(import.meta.dirname);

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-codex-'));
  home = path.join(root, 'home');
  cwd = path.join(root, 'repo');
  fs.mkdirSync(cwd, { recursive: true });
  vi.mocked(os.homedir).mockReturnValue(home);
  vi.stubEnv('CLAUDE_CONFIG_DIR', path.join(home, '.claude'));
  vi.stubEnv('CODEX_HOME', path.join(home, 'codex-config'));
  out = [];
  err = [];
  io = { cwd, stdout: (s) => out.push(s), stderr: (s) => err.push(s) };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  fs.rmSync(root, { recursive: true, force: true });
});

function skill(name: string, file = 'SKILL.md'): string {
  return path.join(home, '.agents', 'skills', name, file);
}

async function install(payload = authored): Promise<number> {
  return runNexusCli(
    ['install', '--harness', 'codex', '--payload', payload],
    io,
  );
}

describe('Codex component lifecycle', () => {
  it('installs every pipeline stage as an explicit Codex skill from the shared payload', async () => {
    expect(await install()).toBe(0);
    for (const rel of listComponentFiles(authored).filter((p) =>
      p.startsWith('commands/'),
    )) {
      const name = path.basename(rel, '.md').replaceAll('.', '-');
      const body = fs.readFileSync(skill(name), 'utf8');
      expect(body).toContain(`name: ${name}`);
      expect(body).toMatch(/^description: .+/m);
      expect(body).not.toMatch(/^(model|tools|category):/m);
      expect(
        fs.readFileSync(skill(name, 'agents/openai.yaml'), 'utf8'),
      ).toContain('allow_implicit_invocation: false');
    }
    expect(fs.existsSync(path.join(home, 'codex-config'))).toBe(false);
    expect(fs.existsSync(path.join(home, '.claude'))).toBe(false);
    expect(out.join('\n')).not.toContain('Bash(nexus:*)');
  });

  it('adapts setup, helper calls, stage references and review roles without a name collision', async () => {
    expect(await install()).toBe(0);
    const setup = fs.readFileSync(skill('nxs-setup'), 'utf8');
    expect(setup).toContain('AGENTS.md');
    expect(setup).not.toContain('CLAUDE.md');
    expect(setup).toContain('nxs-product-context');
    expect(fs.readFileSync(skill('nxs-product-context'), 'utf8')).toContain(
      'at most 5 questions',
    );
    const epic = fs.readFileSync(skill('nxs-epic'), 'utf8');
    expect(epic).toContain('$nxs-discover');
    expect(epic).toContain('nxs-epic-gate');
    expect(epic).toContain('$ARGUMENTS');
    expect(epic).toContain('explicit answer');
    const role = fs.readFileSync(skill('nxs-architect'), 'utf8');
    expect(role).toContain('read-only');
    expect(role).not.toContain('model: opus');
    expect(fs.readFileSync(skill('nxs-council'), 'utf8')).toContain(
      'sequentially',
    );
  });

  it('ports the epic gate as the shared pre-ticked checklist without a Codex-only convention', async () => {
    expect(await install()).toBe(0);
    const epic = fs.readFileSync(skill('nxs-epic'), 'utf8');
    const razor = fs.readFileSync(skill('nxs-razor'), 'utf8');

    expect(epic).toContain('### The filed set — untick to drop, tick to add');
    expect(epic).toMatch(/every number flips exactly one line/i);
    expect(epic).toMatch(
      /Each line carries its tick, its\s+number, its blockers and its provenance/,
    );
    expect(epic).toMatch(/asked fragment, verbatim/);
    expect(epic).toMatch(/stories and the boundaries are not rendered here/i);
    expect(epic).toMatch(/What a tick governs.+nxs-razor §8/is);
    expect(epic).toMatch(/read §8 rather than re-deriving it\s+here/i);
    expect(epic).not.toMatch(/scoring its own additions/);
    expect(epic).toMatch(
      /Re-derive the `## Smallest Usable Version` line from the filed story set/,
    );
    expect(epic).toMatch(/empty selection is identical to a plain approval/i);
    expect(epic).not.toContain('### Additions — taken only if you name them');
    expect(epic).not.toContain('approve with all');

    expect(razor).toMatch(/list is that default, written out and pre-ticked/i);
    expect(razor).toMatch(/number flips the line it names/i);
    expect(razor).toMatch(/unticked \*\*asked-for\*\* story.+defers/is);
    expect(razor).toMatch(/unticked \*\*model-added\*\* story.+discarded/is);
  });

  it("keeps Claude's install byte-for-byte intact when Codex is installed and removed", async () => {
    expect(await runNexusCli(['install', '--payload', authored], io)).toBe(0);
    expect(await install()).toBe(0);
    expect(await runNexusCli(['uninstall', '--harness', 'codex'], io)).toBe(0);
    expect(fs.existsSync(skill('nxs-epic'))).toBe(false);
    for (const rel of listComponentFiles(authored)) {
      expect(fs.readFileSync(path.join(home, '.claude', rel))).toEqual(
        fs.readFileSync(path.join(authored, rel)),
      );
    }
  });

  it('refreshes and retires only its skills, preserving user files and other packages', async () => {
    expect(await install()).toBe(0);
    fs.mkdirSync(path.dirname(skill('nxs-other-package')), { recursive: true });
    fs.writeFileSync(skill('nxs-other-package'), 'another package');
    const ledgerFile = path.join(home, '.agents', INSTALL_LEDGER_FILE);
    const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
    ledger['other-package'] = ['skills/nxs-other-package/SKILL.md'];
    fs.writeFileSync(ledgerFile, JSON.stringify(ledger));
    fs.mkdirSync(path.dirname(skill('my-review')), { recursive: true });
    fs.writeFileSync(skill('my-review'), 'mine');
    fs.writeFileSync(
      path.join(home, '.agents', 'AGENTS.md'),
      'account instructions',
    );
    const payload = path.join(root, 'payload');
    fs.mkdirSync(path.join(payload, 'commands'), { recursive: true });
    fs.writeFileSync(
      path.join(payload, 'commands', 'nxs.epic.md'),
      '---\ndescription: Updated epic\n---\nUpdated\n',
    );
    expect(await install(payload)).toBe(0);
    expect(fs.readFileSync(skill('nxs-epic'), 'utf8')).toContain('Updated');
    expect(fs.existsSync(skill('nxs-close'))).toBe(false);
    expect(await install(payload)).toBe(0);
    expect(await runNexusCli(['uninstall', '--harness', 'codex'], io)).toBe(0);
    expect(fs.readFileSync(skill('my-review'), 'utf8')).toBe('mine');
    expect(fs.readFileSync(skill('nxs-other-package'), 'utf8')).toBe(
      'another package',
    );
    expect(
      fs.readFileSync(path.join(home, '.agents', 'AGENTS.md'), 'utf8'),
    ).toBe('account instructions');
  });

  it("reports the selected harness's installed state", async () => {
    expect(await install()).toBe(0);
    out.length = 0;
    expect(await runNexusCli(['version', '--harness', 'codex'], io)).toBe(0);
    const report = JSON.parse(out[0]);
    expect(report.installLocation.path).toBe(path.join(home, '.agents'));
    expect(report.installLocation.content).toBe('copy');
    expect(report.installLocation.checkout).toBeNull();
  });

  it('supports repository-local Codex deployment', async () => {
    expect(
      await runNexusCli(
        ['deploy', '--harness', 'codex', '--payload', authored],
        io,
      ),
    ).toBe(0);
    expect(
      fs.existsSync(
        path.join(cwd, '.agents', 'skills', 'nxs-epic', 'SKILL.md'),
      ),
    ).toBe(true);
    expect(fs.existsSync(path.join(cwd, '.claude'))).toBe(false);
  });

  it('warns about duplicate Codex installs but accepts Claude and Codex together', async () => {
    expect(await install()).toBe(0);
    expect(await runNexusCli(['install', '--payload', authored], io)).toBe(0);
    expect(detectEnvironmentDefects({ cwd, home })).toEqual([]);
    expect(
      await runNexusCli(
        ['deploy', '--harness', 'codex', '--payload', authored],
        io,
      ),
    ).toBe(0);
    const defects = detectEnvironmentDefects({ cwd, home });
    expect(defects).toHaveLength(1);
    expect(defects[0].detail).toContain(path.join(home, '.agents'));
    expect(defects[0].detail).toContain(path.join(cwd, '.agents'));
    expect(defects[0].remedy).not.toContain('migrate-components');
  });

  it('generates a refreshable Codex snapshot from a checkout without changing the source', async () => {
    const checkout = path.join(root, 'checkout');
    const source = checkoutComponentRoot(checkout);
    fs.mkdirSync(path.join(source, 'commands'), { recursive: true });
    const command = path.join(source, 'commands', 'nxs.epic.md');
    fs.writeFileSync(command, '---\ndescription: Epic\n---\nFirst\n');
    const args = ['install', '--harness', 'codex', '--from-checkout', checkout];
    expect(await runNexusCli(args, io)).toBe(0);
    expect(out.join('\n')).toMatch(/snapshot/i);
    fs.writeFileSync(command, '---\ndescription: Epic\n---\nSecond\n');
    expect(await runNexusCli(args, io)).toBe(0);
    expect(fs.readFileSync(skill('nxs-epic'), 'utf8')).toContain('Second');
    expect(await runNexusCli(['uninstall', '--harness', 'codex'], io)).toBe(0);
    expect(fs.readFileSync(command, 'utf8')).toContain('Second');
  });

  it('refuses a missing or invalid payload without erasing the previous install', async () => {
    expect(await install()).toBe(0);
    const before = fs.readFileSync(skill('nxs-epic'), 'utf8');
    expect(await install(path.join(root, 'absent'))).toBe(1);
    const empty = path.join(root, 'empty');
    fs.mkdirSync(empty);
    expect(await install(empty)).toBe(1);
    expect(fs.readFileSync(skill('nxs-epic'), 'utf8')).toBe(before);
  });

  it.each(['install', 'uninstall', 'version', 'deploy'])(
    'rejects unknown harnesses for %s before changing files',
    async (verb) => {
      expect(await runNexusCli([verb, '--harness', 'unknown'], io)).toBe(2);
      expect(err.join('\n')).toContain('claude or codex');
      expect(fs.existsSync(home)).toBe(false);
    },
  );
});
