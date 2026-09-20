/**
 * Adapt the shared component payload to Codex skills at install time. Claude keeps the authored
 * bytes; Codex gets native skill metadata and a small runtime compatibility contract. Generating
 * from the shipped payload keeps every stage, gate and helper on the same release as the CLI.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  deployComponents,
  payloadDirectory,
  type DeployResult,
  type MirrorOptions,
} from './deploy-components.js';
import { listComponentFiles } from './vendor-components.js';

const CODEX_RUNTIME = `## Codex runtime

The following workflow is shared with Claude. Apply these Codex bindings wherever its host-specific
wording differs; these bindings take precedence over tool names and interaction UI requirements:

- Treat \`$ARGUMENTS\` as the user's text following the skill invocation, including flags. It is
  conversational input, not a shell variable. Preserve the workflow's argument parsing and gates.
- Load a named skill by reading its sibling \`../<name>/SKILL.md\` relative to this skill directory.
  Read its full instructions before using it. \`Skill\` means this operation, not a required tool.
- \`Read\`, \`Grep\`, \`Glob\`, \`Bash\`, \`Write\`, \`Edit\` and \`WebSearch\` mean the corresponding
  available Codex capabilities. Use the shell for local inspection and apply_patch for file edits.
- \`AskUserQuestion\` means present the stated choices and obtain an explicit answer. Use an available
  user-input tool when it supports the question; otherwise ask in normal conversation and wait.
  Show previews as ordinary text if the UI lacks preview or multi-select fields. An omitted answer
  never approves an action. Preserve every approval and mandatory stop in the workflow.
- Keep an approval gate's complete decision surface and choices in the same final response when
  asking in normal conversation; do not rely on an earlier progress update remaining visible. If a
  choice tool cannot collect an action and typed detail such as numbered flips in one answer, use
  normal conversation and accept both together, for example \`approve with changes 2, 4\`, without a
  second confirmation.
- \`Task\` and named agents mean specialist reviews using the sibling skill of that name. When
  subagents are available, give each the full role instructions, brief and resolved docs root.
  Otherwise perform the reviews sequentially with the same inputs, keep their findings distinct,
  and disclose that they were not independent subagent runs. Never invent a tool or review result.
- Use the current Codex model and its configured permissions. Claude tool lists and model choices
  are not Codex configuration. Do not change permission settings or bypass approval requirements.

## Workflow

`;

function adapt(text: string): string {
  return (
    text
      // The helper used to share setup's name once the command's dot becomes a hyphen.
      .replace(/\bnxs-setup\b/g, 'nxs-product-context')
      .replace(
        /\/nxs\.([a-z][a-z0-9-]*)/g,
        (_match, name: string) => `$nxs-${name}`,
      )
      .replace(/CLAUDE\.md/g, 'AGENTS.md')
      .replace(/Claude Code/g, 'Codex')
      .replace(
        /Claude configuration\s+directory/g,
        'Codex account skills directory',
      )
      .replace(
        /\bnexus (install|uninstall|version)\b(?! --harness)/g,
        'nexus $1 --harness codex',
      )
  );
}

/** Render everything before touching an installed set, so malformed input cannot erase it. */
export function renderCodexComponents(payload: string): Map<string, Buffer> {
  if (!fs.existsSync(payload) || !fs.statSync(payload).isDirectory()) {
    throw new Error(`component payload not found at ${payload}`);
  }
  const result = new Map<string, Buffer>();
  const put = (rel: string, body: string | Buffer): void => {
    if (result.has(rel)) throw new Error(`Codex skill path collision: ${rel}`);
    result.set(rel, Buffer.isBuffer(body) ? body : Buffer.from(body));
  };
  for (const rel of listComponentFiles(payload)) {
    const parts = rel.split('/');
    const kind = parts[0];
    const source = fs.readFileSync(path.join(payload, ...parts));
    const entry =
      kind === 'skills'
        ? parts.length === 3 && parts[2] === 'SKILL.md'
        : parts.length === 2 && rel.endsWith('.md');
    const originalName =
      kind === 'skills' ? parts[1] : path.basename(rel, '.md');
    const name =
      kind === 'skills' && originalName === 'nxs-setup'
        ? 'nxs-product-context'
        : originalName.replaceAll('.', '-');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) {
      throw new Error(`Invalid Codex skill name from ${rel}: ${name}`);
    }
    if (!entry) {
      if (kind !== 'skills')
        throw new Error(`Unsupported Codex component: ${rel}`);
      // Keep helper resources beside the skill, including relative scripts and assets.
      put(`skills/${name}/${parts.slice(2).join('/')}`, source);
      continue;
    }
    const content = source.toString('utf8');
    const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    const workflow = content.slice(frontmatter?.[0].length ?? 0).trimStart();
    // Older helper documents have no frontmatter. Their first prose paragraph is the
    // authored synopsis, so reuse it instead of maintaining a second description registry.
    const synopsis = workflow
      .split(/\r?\n\s*\r?\n/)
      .find((paragraph) => !paragraph.startsWith('#'))
      ?.replace(/\s+/g, ' ')
      .trim();
    const description =
      frontmatter?.[1].match(/^description:\s*(.+)$/m)?.[1]?.trim() ??
      (!content.startsWith('---') ? synopsis : undefined);
    if (!description || /^[>|]/.test(description)) {
      throw new Error(
        `Codex component needs a single-line description: ${rel}`,
      );
    }
    const body = adapt(workflow);
    const role =
      kind === 'agents'
        ? 'This is a read-only specialist review. Return findings; do not modify files or external state.\n\n'
        : '';
    put(
      `skills/${name}/SKILL.md`,
      `---\nname: ${name}\ndescription: ${JSON.stringify(adapt(description))}\n---\n\n${CODEX_RUNTIME}${role}${body}`,
    );
    put(
      `skills/${name}/agents/openai.yaml`,
      'policy:\n  allow_implicit_invocation: false\n',
    );
  }
  if (![...result.keys()].some((rel) => rel.endsWith('/SKILL.md'))) {
    throw new Error(`No Codex skills found in component payload at ${payload}`);
  }
  return result;
}

/** Reuse the ownership-aware mirror for both harnesses; generation never writes into the source. */
export function deployCodexComponents(
  payload: string,
  location: string,
  options: MirrorOptions = {},
): DeployResult {
  const files = renderCodexComponents(payload);
  const staging = fs.mkdtempSync(
    path.join(os.tmpdir(), 'nexus-codex-payload-'),
  );
  try {
    for (const [rel, bytes] of files) {
      const dest = path.join(staging, ...rel.split('/'));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, bytes);
    }
    return deployComponents(payloadDirectory(staging), location, {
      ...options,
      mode: 'copy',
    });
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
