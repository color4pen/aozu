/**
 * Graph builder — constructs a Graph from a ParseResult.
 *
 * `buildGraph` is a pure function: no file I/O.
 */

import type { ParseResult, Element } from "../parse/types.ts";
import type { Graph, ElementTable, ReferenceIndex } from "./types.ts";

/**
 * Build a Graph from a ParseResult.
 *
 * @param parsed      The aggregated parse result.
 * @param manifestPath  Path to the manifest file (for callers to locate it).
 *                      Pass `null` if the manifest was not found.
 */
export function buildGraph(parsed: ParseResult, manifestPath: string | null = null): Graph {
  // Build ElementTable (last-wins on duplicate IDs)
  const elements: ElementTable = new Map<string, Element>();
  for (const el of parsed.elements) {
    elements.set(el.id, el);
  }

  // Preserve raw element array (declaration order, with duplicates)
  const rawElements = [...parsed.elements];

  // Build ReferenceIndex
  const bySource = new Map<string, import("../parse/types.ts").Reference[]>();
  const byTarget = new Map<string, import("../parse/types.ts").Reference[]>();
  for (const ref of parsed.references) {
    // bySource
    const srcList = bySource.get(ref.file) ?? [];
    srcList.push(ref);
    bySource.set(ref.file, srcList);

    // byTarget
    const tgtList = byTarget.get(ref.targetId) ?? [];
    tgtList.push(ref);
    byTarget.set(ref.targetId, tgtList);
  }
  const references: ReferenceIndex = {
    bySource,
    byTarget,
    all: [...parsed.references],
  };

  return {
    elements,
    rawElements,
    references,
    dependencyEdges: [...parsed.dependencyEdges],
    actorIds: [...parsed.actorIds],
    elementItems: [...parsed.elementItems],
    implementations: [...(parsed.implementations ?? [])],
    permOperations: [...(parsed.permOperations ?? [])],
    targetLines: [...(parsed.targetLines ?? [])],
    malformedPermOperations: [...(parsed.malformedPermOperations ?? [])],
    manifestPath,
  };
}

/**
 * Resolve an element by ID.
 *
 * Returns the Element if found, or `undefined` for unknown IDs.
 */
export function resolveId(graph: Graph, id: string): Element | undefined {
  return graph.elements.get(id);
}
