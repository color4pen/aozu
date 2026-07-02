/**
 * Type definitions for the graph module.
 *
 * The graph module builds an element table and reference index from a ParseResult,
 * providing efficient ID resolution and reference lookup for the check module.
 */

import type { Element, Reference, DependencyEdge, ParseResult } from "../parse/types.ts";

/** Map from element ID to Element. Built from ParseResult.elements. */
export type ElementTable = Map<string, Element>;

/** Reference index providing lookup by source file and target ID. */
export interface ReferenceIndex {
  /** References indexed by source file path. */
  bySource: Map<string, Reference[]>;
  /** References indexed by target ID. */
  byTarget: Map<string, Reference[]>;
  /** All references as a flat array. */
  all: Reference[];
}

/** Parsed manifest: format version and enabled type list. */
export interface Manifest {
  formatVersion: string;
  enabled: string[];
}

/**
 * The graph: element table, reference index, and ancillary data derived from ParseResult.
 *
 * `rawElements` preserves declaration order and duplicates (Map construction deduplicates
 * by last-wins, so C2 duplicate detection uses rawElements rather than elements).
 */
export interface Graph {
  /** ID → Element lookup table (duplicates resolved to last declaration). */
  elements: ElementTable;
  /** All declared elements in declaration order, including duplicates. */
  rawElements: Element[];
  /** Reference index. */
  references: ReferenceIndex;
  /** Dependency edges from static/dependencies.md. */
  dependencyEdges: DependencyEdge[];
  /** Actor IDs from seq `## 登場要素` sections. */
  actorIds: ParseResult["actorIds"];
  /** Element IDs from plan `elements:` lines. */
  elementItems: ParseResult["elementItems"];
  /** Path to the manifest file, or null if not found. */
  manifestPath: string | null;
}
