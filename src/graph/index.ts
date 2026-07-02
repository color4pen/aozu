/**
 * Public API for the graph module.
 *
 * Re-exports graph types, the builder function, and ID utilities from parse
 * (so that check module imports go through graph rather than directly into parse).
 */

export type { ElementTable, ReferenceIndex, Manifest, Graph } from "./types.ts";
export { buildGraph, resolveId } from "./builder.ts";

// Re-export ID utilities from parse so check can use them via graph
export { validateId, extractPrefix, KNOWN_PREFIXES } from "../parse/id.ts";
