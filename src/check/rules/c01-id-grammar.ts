/**
 * C1: All IDs SHALL conform to the ID grammar.
 *
 * spec/format.md §10 C1: すべての ID が文法に適合する
 */

import type { Graph } from "../../graph/types.ts";
import type { CheckDiagnostic } from "../types.ts";
import { validateId } from "../../graph/index.ts";

/**
 * Check C1: Verify that all declared element IDs match the ID grammar.
 *
 * Invalid IDs produce an error diagnostic with code "C1".
 */
export function checkC1(graph: Graph): CheckDiagnostic[] {
  const diagnostics: CheckDiagnostic[] = [];

  for (const el of graph.rawElements) {
    const result = validateId(el.id);
    if (!result.valid) {
      diagnostics.push({
        level: "error",
        code: "C1",
        elementId: el.id,
        message: `invalid ID "${el.id}": ${result.reason}`,
        file: el.file,
        line: el.line,
      });
    }
  }

  return diagnostics;
}
