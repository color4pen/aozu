/**
 * Public API for the export module.
 *
 * Re-exports types and the main `generateRuleset` function.
 */

export type { Ruleset, ExportDiagnostic, GenerateResult } from "./types.ts";
export { generateRuleset } from "./generator.ts";
