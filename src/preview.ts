export function renderLaunchPreview(cmd: string[]): string {
  const displayCmd = cmd.map(escapeControlChars);
  return `+ ${displayCmd.map(shellQuote).join(" ")}\n`;
}

function shellQuote(arg: string): string {
  if (arg.length === 0) return "''";
  if (!/[^a-zA-Z0-9_.=:/@+,-]/.test(arg)) return arg;
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

function escapeControlChars(text: string): string {
  return text.replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
}
