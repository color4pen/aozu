/**
 * C5: Sequence actor lists SHALL be non-empty and resolve to mod elements.
 *
 * spec/format.md §10 C5: seq の登場要素リストが空でなく、すべて mod に解決される
 */

import type { Graph } from "../../graph/types.ts";
import type { CheckDiagnostic } from "../types.ts";
import { extractPrefix } from "../../graph/index.ts";

/**
 * Check C5: For every seq element, verify:
 * - Its `## 登場要素` section contains at least one entry.
 * - All entries have prefix `mod`.
 */
export function checkC5(graph: Graph): CheckDiagnostic[] {
  const diagnostics: CheckDiagnostic[] = [];

  // Find all seq elements
  const seqElements = graph.rawElements.filter((el) => el.prefix === "seq");

  for (const seqEl of seqElements) {
    // Collect actorIds for this seq file
    const actors = graph.actorIds.filter((a) => a.file === seqEl.file);

    if (actors.length === 0) {
      diagnostics.push({
        level: "error",
        code: "C5",
        elementId: seqEl.id,
        message: `seq element "${seqEl.id}" has an empty ## 登場要素 section`,
        file: seqEl.file,
        line: seqEl.line,
      });
      continue;
    }

    for (const actor of actors) {
      if (extractPrefix(actor.id) !== "mod") {
        diagnostics.push({
          level: "error",
          code: "C5",
          elementId: seqEl.id,
          message: `seq element "${seqEl.id}" actor "${actor.id}" is not a mod element (prefix: "${extractPrefix(actor.id)}")`,
          file: actor.file,
          line: actor.line,
        });
      }
    }
  }

  return diagnostics;
}
