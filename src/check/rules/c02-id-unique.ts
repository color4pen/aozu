/**
 * C2: IDs SHALL be unique across the repository.
 *
 * spec/format.md §10 C2: ID がリポジトリ全体で一意
 */

import type { Graph } from "../../graph/types.ts";
import type { CheckDiagnostic } from "../types.ts";

/**
 * Check C2: Verify that no element ID is declared more than once.
 *
 * Uses `graph.rawElements` (preserves duplicates) rather than `graph.elements`
 * (which deduplicates by last-wins). Each duplicate declaration (2nd and beyond)
 * produces an error diagnostic with code "C2".
 */
export function checkC2(graph: Graph): CheckDiagnostic[] {
  const diagnostics: CheckDiagnostic[] = [];
  const seen = new Map<string, { file: string; line: number }>();

  for (const el of graph.rawElements) {
    const existing = seen.get(el.id);
    if (existing) {
      diagnostics.push({
        level: "error",
        code: "C2",
        elementId: el.id,
        message: `duplicate ID "${el.id}" (first declared at ${existing.file}:${existing.line})`,
        file: el.file,
        line: el.line,
      });
    } else {
      seen.set(el.id, { file: el.file, line: el.line });
    }
  }

  return diagnostics;
}
