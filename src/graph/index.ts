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

// Re-export parse types so consumers can import via graph without depending on parse directly
export type { ParseResult, Element, FileInput } from "../parse/types.ts";

// Re-export attribution utility so mod-plan / mod-prompt can use it via mod-graph
export { findOwningElement } from "./attribution.ts";
