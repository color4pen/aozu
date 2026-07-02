/**
 * Reference extractor (spec/format.md §6).
 *
 * Extracts `[[id]]` occurrences from content while excluding:
 *   - Code fence blocks (lines between ``` markers)
 *   - Inline code spans (backtick-delimited text on the same line)
 *
 * This matches the line-oriented approach described in spec/format.md §6 and
 * implemented in tools/check.sh.
 */

import type { Reference } from "./types.ts";

/** Pattern matching a reference `[[...]]` where content is `[a-z0-9-]+`. */
const REF_RE = /\[\[([a-z0-9-]+)\]\]/g;

/**
 * Remove inline code spans from a line.
 * Handles non-nested single-backtick spans (`` `...` ``).
 * Matches the AWK `gsub(/`[^`]*`/, "", line)` in tools/check.sh.
 */
export function stripInlineCode(line: string): string {
  return line.replace(/`[^`]*`/g, "");
}

/**
 * Extract all `[[id]]` references from a single line (after stripping inline code).
 */
export function extractRefsFromLine(line: string): string[] {
  const stripped = stripInlineCode(line);
  const refs: string[] = [];
  let match: RegExpExecArray | null;
  // Reset lastIndex in case the regex was used before
  REF_RE.lastIndex = 0;
  while ((match = REF_RE.exec(stripped)) !== null) {
    refs.push(match[1]!);
  }
  return refs;
}

/**
 * Extract all references from file content, respecting code fence and inline code
 * exclusions.
 *
 * @param content  Raw file content.
 * @param filePath File path attached to each returned reference.
 */
export function extractReferences(
  content: string,
  filePath: string
): Reference[] {
  const lines = content.split("\n");
  const references: Reference[] = [];
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNumber = i + 1; // 1-based

    // Toggle code fence on lines that start with ``` (any language specifier)
    if (line.trimStart().startsWith("```")) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) continue;

    for (const targetId of extractRefsFromLine(line)) {
      references.push({ targetId, file: filePath, line: lineNumber });
    }
  }

  return references;
}
