/**
 * Frontmatter parser (spec/format.md §7).
 *
 * Parses flat `key: value` frontmatter delimited by `---` lines at the start
 * of a file. Values may be comma-separated lists. Nested / indented structures
 * are reported as diagnostics.
 */

import type { Diagnostic } from "./types.ts";

export interface FrontmatterResult {
  /** Parsed key-value pairs. String arrays for comma-separated values. */
  record: Record<string, string | string[]>;
  /** Diagnostics for malformed frontmatter (non-flat lines, etc.). */
  diagnostics: Diagnostic[];
  /**
   * Line index (0-based) of the first line AFTER the frontmatter block.
   * 0 if there is no frontmatter.
   */
  bodyStart: number;
}

/**
 * Parse frontmatter from file content.
 *
 * @param content  Raw file content.
 * @param filePath Used for diagnostic positions.
 */
export function parseFrontmatter(
  content: string,
  filePath: string
): FrontmatterResult {
  const lines = content.split("\n");
  const diagnostics: Diagnostic[] = [];

  // Frontmatter must start on line 0 with exactly `---`
  if (lines[0]?.trim() !== "---") {
    return { record: {}, diagnostics: [], bodyStart: 0 };
  }

  // Find closing `---`
  let closeIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      closeIndex = i;
      break;
    }
  }

  // Unclosed frontmatter: treat everything from line 1 onwards as frontmatter body
  const fmLines =
    closeIndex >= 0 ? lines.slice(1, closeIndex) : lines.slice(1);
  const bodyStart = closeIndex >= 0 ? closeIndex + 1 : lines.length;

  const record: Record<string, string | string[]> = {};

  for (let i = 0; i < fmLines.length; i++) {
    const rawLine = fmLines[i]!;
    const lineNumber = i + 2; // 1-based; line 1 is the opening `---`

    // Blank lines are allowed
    if (rawLine.trim() === "") continue;

    // Indented lines → non-flat diagnostic
    if (rawLine !== rawLine.trimStart()) {
      diagnostics.push({
        severity: "error",
        message: `non-flat frontmatter: indented line "${rawLine.trim()}"`,
        file: filePath,
        line: lineNumber,
      });
      continue;
    }

    const colonIndex = rawLine.indexOf(":");
    if (colonIndex < 0) {
      diagnostics.push({
        severity: "error",
        message: `malformed frontmatter line: "${rawLine}"`,
        file: filePath,
        line: lineNumber,
      });
      continue;
    }

    const key = rawLine.slice(0, colonIndex).trim();
    const rawValue = rawLine.slice(colonIndex + 1).trim();

    if (key === "") {
      diagnostics.push({
        severity: "error",
        message: `frontmatter line has empty key: "${rawLine}"`,
        file: filePath,
        line: lineNumber,
      });
      continue;
    }

    // Check for multi-line value (value is empty and next line is indented)
    if (rawValue === "" && i + 1 < fmLines.length) {
      const nextLine = fmLines[i + 1]!;
      if (nextLine.trim() !== "" && nextLine !== nextLine.trimStart()) {
        diagnostics.push({
          severity: "error",
          message: `non-flat frontmatter: multi-line value for key "${key}"`,
          file: filePath,
          line: lineNumber,
        });
        // Skip the next indented lines
        while (
          i + 1 < fmLines.length &&
          fmLines[i + 1]!.trim() !== "" &&
          fmLines[i + 1] !== fmLines[i + 1]!.trimStart()
        ) {
          i++;
        }
        continue;
      }
    }

    // Parse comma-separated list if value contains a comma
    if (rawValue.includes(",")) {
      record[key] = rawValue
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v !== "");
    } else {
      record[key] = rawValue;
    }
  }

  return { record, diagnostics, bodyStart };
}
