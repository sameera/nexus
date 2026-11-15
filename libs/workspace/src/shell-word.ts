/** One argument in a command printed for the user's default shell, never for process spawning. */
export function shellWord(value: string, platform: NodeJS.Platform = process.platform): string {
    if ((platform === 'win32' ? /^[\w.~\\/@%+=:,-]+$/ : /^[\w./@%+=:,-]+$/).test(value)) return value;
    return `'${value.replace(/'/g, platform === 'win32' ? "''" : "'\\''")}'`;
}
