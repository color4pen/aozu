/**
 * Command registry for the aozu CLI.
 *
 * Provides a minimal, framework-free command dispatch mechanism.
 * Each command is a name → handler mapping with an optional description.
 * (ADR-0009: no CLI framework dependency)
 */

/** A command handler. Returns an exit code (0 = ok, 1 = failure, 2 = input error). */
export type CommandHandler = (args: string[]) => Promise<number>;

/** A registered command definition. */
export interface CommandDef {
  handler: CommandHandler;
  description: string;
}

/** A command registry mapping command names to their definitions. */
export type Registry = Map<string, CommandDef>;

/** Create an empty command registry. */
export function createRegistry(): Registry {
  return new Map();
}

/** Register a command in the registry. */
export function register(
  registry: Registry,
  name: string,
  handler: CommandHandler,
  description: string
): void {
  registry.set(name, { handler, description });
}

/**
 * Dispatch a command by name.
 *
 * - If found: invoke handler with `args` and return its exit code.
 * - If not found: write error to stderr and return 2.
 */
export async function dispatch(
  registry: Registry,
  commandName: string,
  args: string[]
): Promise<number> {
  const def = registry.get(commandName);
  if (!def) {
    process.stderr.write(`aozu: unknown command '${commandName}'\n`);
    process.stderr.write(`Run 'aozu --help' to see available commands.\n`);
    return 2;
  }
  return def.handler(args);
}

/**
 * Generate a help text listing all registered commands.
 */
export function helpText(registry: Registry): string {
  const lines: string[] = [
    "aozu — design layer CLI",
    "",
    "Usage: aozu <command> [options]",
    "",
    "Commands:",
  ];
  for (const [name, def] of registry) {
    lines.push(`  ${name.padEnd(16)}${def.description}`);
  }
  lines.push("");
  lines.push("Run 'aozu <command> --help' for command-specific options.");
  return lines.join("\n");
}
