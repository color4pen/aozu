/**
 * Graph neighborhood computation (mod-graph).
 *
 * Computes the set of element IDs reachable from a set of seed IDs by
 * traversing the reference graph in both directions (in / out) up to
 * `maxHops` hops.
 *
 * Uses `findOwningElement` to map reference file+line positions back to
 * element IDs, enabling element-level graph traversal over raw references.
 */

import type { Graph } from "./types.ts";
import { findOwningElement } from "./attribution.ts";

/**
 * Compute the element IDs reachable from `seedIds` within `maxHops` hops
 * on the reference graph, traversing both in (←) and out (→) directions.
 *
 * @param seedIds   Starting element IDs. These are NOT included in the result.
 * @param graph     The reference graph.
 * @param maxHops   Maximum number of hops from any seed (e.g. 2 for 2-hop neighborhood).
 * @returns         Set of reachable element IDs, excluding the seed IDs themselves.
 */
export function computeNeighborhood(
  seedIds: string[],
  graph: Graph,
  maxHops: number
): Set<string> {
  const result = new Set<string>();
  // visited includes seeds so we don't add them to the result or revisit them
  const visited = new Set<string>(seedIds);

  // Snapshot of all elements for findOwningElement lookups
  const allElements = [...graph.elements.values()];

  let frontier = new Set<string>(seedIds);

  for (let hop = 0; hop < maxHops; hop++) {
    if (frontier.size === 0) break;

    const nextFrontier = new Set<string>();

    for (const id of frontier) {
      const el = graph.elements.get(id);
      if (!el) continue;

      // --- Out-direction: elements that `id` references ---
      // Find all references whose owning element is `id`
      const refsFromFile = graph.references.bySource.get(el.file) ?? [];
      for (const ref of refsFromFile) {
        const owner = findOwningElement(allElements, ref.file, ref.line);
        if (owner?.id !== id) continue;

        const targetId = ref.targetId;
        if (!visited.has(targetId) && graph.elements.has(targetId)) {
          nextFrontier.add(targetId);
          result.add(targetId);
          visited.add(targetId);
        }
      }

      // --- In-direction: elements that reference `id` ---
      const refsToId = graph.references.byTarget.get(id) ?? [];
      for (const ref of refsToId) {
        const owner = findOwningElement(allElements, ref.file, ref.line);
        if (!owner) continue;

        const ownerId = owner.id;
        if (!visited.has(ownerId) && graph.elements.has(ownerId)) {
          nextFrontier.add(ownerId);
          result.add(ownerId);
          visited.add(ownerId);
        }
      }
    }

    frontier = nextFrontier;
  }

  return result;
}
