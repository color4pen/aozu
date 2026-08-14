/**
 * Operations generator (mod-export).
 *
 * `generateOperations` is a pure function: no file I/O.
 * Produces the spec/format.md §11 operations JSON from a Graph.
 *
 * Output schema:
 * {
 *   "format-version": 0,
 *   "operations": [
 *     {
 *       "id": "op-confirm-order",
 *       "name": "受注を確定する",
 *       "target": ["ent-order"],          // omitted when no 対象: line
 *       "implementation": ["src/app.ts"]  // omitted when no 実装: line
 *     }
 *   ]
 * }
 */

import type { Graph } from "../graph/types.ts";
import { findOwningElement } from "../graph/attribution.ts";

/**
 * Generate operations JSON from the given graph.
 *
 * Algorithm:
 * 1. Collect all `op` elements from `graph.rawElements`, deduplicated by ID.
 * 2. Sort op elements by ID ascending (deterministic output).
 * 3. Associate target lines with owning op element (declaration order preserved).
 * 4. Associate implementation entries with owning op element (line ascending, paths order preserved).
 * 5. `target` / `implementation` keys are included only when the respective lines exist.
 *
 * @returns `{ json }` — the JSON string (including trailing newline).
 */
export function generateOperations(graph: Graph): { json: string } {
  // 1. Collect and deduplicate op elements
  const seenIds = new Set<string>();
  const opElements: typeof graph.rawElements[number][] = [];
  for (const el of graph.rawElements) {
    if (el.prefix === "op" && !seenIds.has(el.id)) {
      seenIds.add(el.id);
      opElements.push(el);
    }
  }

  // 2. Sort by ID ascending
  opElements.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // 3. Group target lines by owning op element (flatten targetIds, preserve declaration order)
  const targetsByOpId = new Map<string, string[]>();
  for (const tl of graph.targetLines) {
    const owner = findOwningElement(graph.rawElements, tl.file, tl.line);
    if (owner && owner.prefix === "op" && seenIds.has(owner.id)) {
      const existing = targetsByOpId.get(owner.id);
      if (existing) {
        existing.push(...tl.targetIds);
      } else {
        targetsByOpId.set(owner.id, [...tl.targetIds]);
      }
    }
  }

  // 4. Group implementation entries by owning op element (line ascending, paths order preserved)
  const implsByOpId = new Map<string, { line: number; paths: string[] }[]>();
  for (const impl of graph.implementations) {
    const owner = findOwningElement(graph.rawElements, impl.file, impl.line);
    if (owner && owner.prefix === "op" && seenIds.has(owner.id)) {
      const existing = implsByOpId.get(owner.id);
      if (existing) {
        existing.push({ line: impl.line, paths: impl.paths });
      } else {
        implsByOpId.set(owner.id, [{ line: impl.line, paths: impl.paths }]);
      }
    }
  }

  // 5. Build operations array
  const operations = opElements.map((el) => {
    const entry: Record<string, unknown> = { id: el.id, name: el.displayName };

    const targets = targetsByOpId.get(el.id);
    if (targets && targets.length > 0) {
      entry["target"] = targets;
    }

    const impls = implsByOpId.get(el.id);
    if (impls && impls.length > 0) {
      // Sort by line ascending, then flatten paths
      impls.sort((a, b) => a.line - b.line);
      entry["implementation"] = impls.flatMap((i) => i.paths);
    }

    return entry;
  });

  const output = {
    "format-version": 0,
    operations,
  };

  const json = JSON.stringify(output, null, 2) + "\n";
  return { json };
}
