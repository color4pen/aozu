/**
 * Type definitions for the export module.
 *
 * Defines the ruleset JSON schema (spec/format.md §11) and related types.
 */

/**
 * Ruleset JSON schema (spec/format.md §11).
 *
 * Consumed by architecture tests in implementation repositories.
 */
export interface Ruleset {
  "format-version": number;
  /** Module IDs in lexicographic order. */
  modules: string[];
  /** Mapping from module ID to implementation paths. */
  paths: Record<string, string[]>;
  /** Permitted dependency edges [from, to] in stable sorted order. */
  allowed: [string, string][];
}

/** A diagnostic emitted during ruleset generation. */
export interface ExportDiagnostic {
  level: "error";
  /** Error code (e.g. "E001"). */
  code: string;
  /** The module ID that triggered the diagnostic. */
  moduleId: string;
  message: string;
}

/** Result of `generateRuleset`. */
export interface GenerateResult {
  /** The generated JSON string (including trailing newline), or null on error. */
  json: string | null;
  diagnostics: ExportDiagnostic[];
}
