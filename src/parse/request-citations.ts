/**
 * Request-document citation classifier (ADR-0024).
 *
 * Classifies [[id]] references in a request document into:
 *   - coverageRefs:    references outside dependency lines (被覆引用)
 *   - dependencyIds:   IDs declared on dependency lines (依存引用)
 *   - malformedLines:  lines beginning with 依存: that don't match the full pattern
 *
 * Dependency line syntax: `依存: [[id]](, [[id]])*`
 *   - 1 or more [[id]] entries, comma-separated, exactly
 *   - code-fence exclusion rules (spec/format.md §6) apply
 *
 * Design-file parsing (extractReferences) is unaffected by this module.
 */

import type { Reference } from "./types.ts";
import { extractRefsFromLine } from "./references.ts";

/** Full pattern for a valid dependency line: `依存: [[id]](, [[id]])*` */
const DEPENDENCY_LINE_RE = /^依存: \[\[[a-z0-9-]+\]\](, \[\[[a-z0-9-]+\]\])*$/;

/** Pattern to extract individual [[id]] values from a dependency line. */
const DEP_ID_RE = /\[\[([a-z0-9-]+)\]\]/g;

/**
 * Result of classifying citations in a request document.
 *
 * - `coverageRefs`:   references outside dependency lines; subject to R1 + R2 checks
 * - `dependencyIds`:  IDs from valid dependency lines; subject to R1 (existence) only
 * - `malformedLines`: lines starting with `依存:` that do not match the valid pattern
 */
export interface RequestCitationResult {
  coverageRefs: Reference[];
  dependencyIds: Set<string>;
  malformedLines: { line: number; text: string }[];
}

/**
 * Extract and classify all [[id]] citations in a request document.
 *
 * Applies spec/format.md §6 code-fence and inline-code exclusion rules.
 * Dependency lines are recognised by the prefix `依存:` and validated against
 * the full grammar. Normal lines are processed with `extractRefsFromLine`.
 *
 * A single [[id]] that appears on both a dependency line and in the body will
 * appear in both `dependencyIds` and `coverageRefs` (classification is
 * per-occurrence, not per-ID).
 *
 * @param content  Raw content of the request document.
 * @param filePath File path attached to each returned Reference.
 */
export function extractRequestCitations(
  content: string,
  filePath: string
): RequestCitationResult {
  const lines = content.split("\n");
  const coverageRefs: Reference[] = [];
  const dependencyIds = new Set<string>();
  const malformedLines: { line: number; text: string }[] = [];
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

    // Dependency line detection
    if (line.startsWith("依存:")) {
      if (DEPENDENCY_LINE_RE.test(line)) {
        // Valid dependency line — extract all [[id]] values
        DEP_ID_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = DEP_ID_RE.exec(line)) !== null) {
          dependencyIds.add(match[1]!);
        }
      } else {
        // Malformed: starts with 依存: but does not match the full grammar
        malformedLines.push({ line: lineNumber, text: line });
      }
      // Dependency line is never parsed for coverageRefs (consumed entirely)
      continue;
    }

    // Normal line — extract coverage references (inline code excluded)
    for (const targetId of extractRefsFromLine(line)) {
      coverageRefs.push({ targetId, file: filePath, line: lineNumber });
    }
  }

  return { coverageRefs, dependencyIds, malformedLines };
}
