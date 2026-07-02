/**
 * C8: state.json keys SHALL resolve to existing elements (loop only).
 *
 * spec/format.md §10 C8: state.json の全キーが実在要素（削除要素の残骸検出）
 */

import type { Graph } from "../../graph/types.ts";
import type { CheckDiagnostic } from "../types.ts";

/**
 * Check C8: Verify that all state.json keys correspond to declared element IDs.
 *
 * @param graph     The graph built from parse results.
 * @param stateKeys Array of keys from state.json (supplied by caller — check module has no I/O).
 */
export function checkC8(graph: Graph, stateKeys: string[]): CheckDiagnostic[] {
  const diagnostics: CheckDiagnostic[] = [];

  for (const key of stateKeys) {
    if (!graph.elements.has(key)) {
      diagnostics.push({
        level: "error",
        code: "C8",
        elementId: key,
        message: `state.json key "${key}" does not correspond to any declared element`,
        file: "state.json",
        line: 0,
      });
    }
  }

  return diagnostics;
}
