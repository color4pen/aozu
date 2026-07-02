/**
 * C4: Dependency edge endpoints SHALL resolve to mod elements.
 *
 * spec/format.md §10 C4: dependencies の辺の両端が mod 要素に解決される
 */

import type { Graph } from "../../graph/types.ts";
import type { CheckDiagnostic } from "../types.ts";
import { extractPrefix } from "../../graph/index.ts";

/**
 * Check C4: Verify that every dependency edge `- [[from]] -> [[to]]` has:
 * - Both endpoints resolving to existing elements.
 * - Both endpoints with prefix `mod`.
 */
export function checkC4(graph: Graph): CheckDiagnostic[] {
  const diagnostics: CheckDiagnostic[] = [];

  for (const edge of graph.dependencyEdges) {
    // Check 'from' endpoint
    const fromElement = graph.elements.get(edge.from);
    if (!fromElement) {
      diagnostics.push({
        level: "error",
        code: "C4",
        elementId: edge.from,
        message: `dependency edge endpoint "${edge.from}" does not resolve to any element`,
        file: edge.file,
        line: edge.line,
      });
    } else if (extractPrefix(edge.from) !== "mod") {
      diagnostics.push({
        level: "error",
        code: "C4",
        elementId: edge.from,
        message: `dependency edge endpoint "${edge.from}" is not a mod element (prefix: "${extractPrefix(edge.from)}")`,
        file: edge.file,
        line: edge.line,
      });
    }

    // Check 'to' endpoint
    const toElement = graph.elements.get(edge.to);
    if (!toElement) {
      diagnostics.push({
        level: "error",
        code: "C4",
        elementId: edge.to,
        message: `dependency edge endpoint "${edge.to}" does not resolve to any element`,
        file: edge.file,
        line: edge.line,
      });
    } else if (extractPrefix(edge.to) !== "mod") {
      diagnostics.push({
        level: "error",
        code: "C4",
        elementId: edge.to,
        message: `dependency edge endpoint "${edge.to}" is not a mod element (prefix: "${extractPrefix(edge.to)}")`,
        file: edge.file,
        line: edge.line,
      });
    }
  }

  return diagnostics;
}
