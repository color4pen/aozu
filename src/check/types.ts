/**
 * Type definitions for the check module.
 */

/**
 * A closure check diagnostic.
 *
 * The `spec/integration.md §1` output format (`<LEVEL> <CODE> <id> <message>`)
 * is produced by the CLI layer. This struct is the in-memory representation.
 */
export interface CheckDiagnostic {
  /** Diagnostic severity. */
  level: "error" | "warning";
  /** Rule code: "C1" through "C11". */
  code: string;
  /** The element ID associated with the diagnostic, or null when not applicable. */
  elementId: string | null;
  /** Human-readable message. */
  message: string;
  /** File where the issue was detected. */
  file: string;
  /** 1-based line number where the issue was detected. */
  line: number;
}
