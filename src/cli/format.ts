/**
 * Diagnostic formatter for the CLI layer.
 *
 * Converts CheckDiagnostic structs to the contract text format defined in
 * spec/integration.md §1: `<LEVEL> <CODE> <id> <message> (<file>:<line>)`
 *
 * Diagnostics are written to stderr (spec/integration.md §5).
 * The check command produces no stdout output.
 */

import type { CheckDiagnostic } from "../check/types.ts";

/**
 * Format a single diagnostic as a contract-form string.
 *
 * Format: `<LEVEL> <CODE> <id> <message> (<file>:<line>)`
 * When `elementId` is null, the id field is rendered as `-`.
 */
export function formatDiagnostic(d: CheckDiagnostic): string {
  const id = d.elementId ?? "-";
  return `${d.level.toUpperCase()} ${d.code} ${id} ${d.message} (${d.file}:${d.line})`;
}

/**
 * Write all diagnostics to stderr, one per line.
 */
export function writeDiagnostics(diagnostics: CheckDiagnostic[]): void {
  for (const d of diagnostics) {
    process.stderr.write(formatDiagnostic(d) + "\n");
  }
}
