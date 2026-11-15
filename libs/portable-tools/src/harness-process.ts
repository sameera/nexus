import * as fs from 'node:fs';
import * as path from 'node:path';

function executable(file: string, windows: boolean): boolean {
  try {
    if (!fs.statSync(file).isFile()) return false;
    fs.accessSync(file, windows ? fs.constants.F_OK : fs.constants.X_OK);
    return true;
  } catch { return false; }
}

/** Resolve without a shell: prompts must never become cmd.exe or PowerShell source. */
export function resolveHarnessInvocation(
  command: string,
  args: string[],
  envPath = process.env['PATH'] ?? '',
  platform: NodeJS.Platform = process.platform,
): { command: string; args: string[] } | null {
  const windows = platform === 'win32';
  const direct = path.isAbsolute(command) || /[/\\]/.test(command);
  const candidates = direct ? [command] : envPath.split(windows ? ';' : ':')
    .filter(Boolean).map((dir) => path.join(dir.replace(/^"|"$/g, ''), command));
  for (const candidate of candidates) {
    if (!windows) {
      if (executable(candidate, false)) return { command: candidate, args };
      continue;
    }
    const native = /\.exe$/i.test(candidate) ? candidate : `${candidate}.exe`;
    if (executable(native, true)) return { command: native, args };
    // npm's Windows shim is a batch file and cannot be spawned directly. Resolve the
    // installed Codex JS entry instead of passing arbitrary prompts through cmd.exe.
    if (path.basename(candidate).replace(/\.(cmd|ps1)$/i, '').toLowerCase() === 'codex') {
      const entry = path.join(path.dirname(candidate), 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
      if (executable(entry, true)) return { command: process.execPath, args: [entry, ...args] };
    }
  }
  return null;
}
