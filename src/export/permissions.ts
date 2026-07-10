/**
 * Permissions generator (mod-export).
 *
 * `generatePermissions` is a pure function: no file I/O.
 * Produces the spec/format.md §11 permissions JSON from a Graph.
 *
 * Output schema:
 * {
 *   "format-version": 0,
 *   "permissions": [
 *     {
 *       "id": "perm-deal",
 *       "target": "ent-deal",   // omitted when no 対象: line
 *       "operations": {
 *         "create": ["act-admin", "act-manager"],
 *         "list": ["act-admin", "act-finance", "act-manager", "act-member"]
 *       }
 *     }
 *   ]
 * }
 */

import type { Graph } from "../graph/types.ts";
import { findOwningElement } from "../graph/attribution.ts";

/**
 * Generate permissions JSON from the given graph.
 *
 * Algorithm:
 * 1. Collect all `perm` elements from `graph.rawElements`, deduplicated by ID.
 * 2. Sort perm elements by ID ascending (deterministic output).
 * 3. Associate operation lines and target lines with owning perm element.
 * 4. Build the permissions array with stable ordering:
 *    - permissions: id ascending
 *    - operations keys: lexicographic
 *    - act arrays: id ascending
 * 5. `target` field is included only when a `対象:` line exists.
 *
 * @returns `{ json }` — the JSON string (including trailing newline).
 */
export function generatePermissions(graph: Graph): { json: string } {
  // 1. Collect and deduplicate perm elements
  const seenIds = new Set<string>();
  const permElements: typeof graph.rawElements[number][] = [];
  for (const el of graph.rawElements) {
    if (el.prefix === "perm" && !seenIds.has(el.id)) {
      seenIds.add(el.id);
      permElements.push(el);
    }
  }

  // 2. Sort by ID ascending
  permElements.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // 3a. Group operation lines by owning perm element
  const opsByPermId = new Map<string, typeof graph.permOperations[number][]>();
  for (const el of permElements) {
    opsByPermId.set(el.id, []);
  }
  for (const op of graph.permOperations) {
    const owner = findOwningElement(graph.rawElements, op.file, op.line);
    if (owner && owner.prefix === "perm" && opsByPermId.has(owner.id)) {
      opsByPermId.get(owner.id)!.push(op);
    }
  }

  // 3b. Group target lines by owning perm element (take first target per perm)
  const targetByPermId = new Map<string, string>();
  for (const tgt of graph.permTargets) {
    const owner = findOwningElement(graph.rawElements, tgt.file, tgt.line);
    if (owner && owner.prefix === "perm" && !targetByPermId.has(owner.id)) {
      targetByPermId.set(owner.id, tgt.targetId);
    }
  }

  // 4. Build permissions array
  const permissions = permElements.map((el) => {
    const ops = opsByPermId.get(el.id) ?? [];

    // Build operations: keys in lexicographic order, values in ID ascending order
    const opKeySet = new Set(ops.map((o) => o.operation));
    const opKeys = [...opKeySet].sort();
    const operations: Record<string, string[]> = {};
    for (const key of opKeys) {
      const actorIds = ops
        .filter((o) => o.operation === key)
        .flatMap((o) => o.actorIds)
        .sort();
      operations[key] = actorIds;
    }

    // Build entry (key order: id, target?, operations)
    const entry: Record<string, unknown> = { id: el.id };
    const target = targetByPermId.get(el.id);
    if (target !== undefined) {
      entry["target"] = target;
    }
    entry["operations"] = operations;

    return entry;
  });

  const output = {
    "format-version": 0,
    permissions,
  };

  const json = JSON.stringify(output, null, 2) + "\n";
  return { json };
}
