/**
 * C9: ADR elements SHALL reference at least one topic (loop only).
 *
 * spec/format.md §10 C9: adr が top を引用している（loop 有効時）
 */

import type { Graph } from "../../graph/types.ts";
import type { CheckDiagnostic } from "../types.ts";

/**
 * Check C9: Verify that every adr element references at least one top element.
 *
 * References in `topics:` frontmatter lines are picked up by extractReferences
 * and are present in graph.references.all, so we check bySource per adr file.
 */
export function checkC9(graph: Graph): CheckDiagnostic[] {
  const diagnostics: CheckDiagnostic[] = [];

  const adrElements = graph.rawElements.filter((el) => el.prefix === "adr");

  for (const adrEl of adrElements) {
    // Find all references from this adr file and check for top-* targets
    const refs = graph.references.bySource.get(adrEl.file) ?? [];
    const hasTopRef = refs.some((r) => r.targetId.startsWith("top-"));

    if (!hasTopRef) {
      diagnostics.push({
        level: "error",
        code: "C9",
        elementId: adrEl.id,
        message: `adr element "${adrEl.id}" does not reference any topic (top-*)`,
        file: adrEl.file,
        line: adrEl.line,
      });
    }
  }

  return diagnostics;
}
