/**
 * Structured line recognizer (spec/format.md §8).
 *
 * Recognizes:
 *   - `責務:` lines (responsibility statement)
 *   - `実装:` lines (implementation path list)
 *   - Dependency edges: `- [[a]] -> [[b]]`
 *   - `## 登場要素` section: `- [[id]]` list items
 *   - `elements:` lines (plan group element lists)
 *   - Perm operation lines: `- <operation>: [[act-id]](, [[act-id]])*`
 *   - Perm target lines: `対象: [[<id>]]`
 */

import type { DependencyEdge, PermOperation, PermTarget } from "./types.ts";

/** Pattern for dependency edge: `- [[from]] -> [[to]]` */
const DEP_EDGE_RE = /^- \[\[([a-z0-9-]+)\]\] -> \[\[([a-z0-9-]+)\]\]$/;

/** Pattern for a single-element list item: `- [[id]]` */
const ELEMENT_ITEM_RE = /^- \[\[([a-z0-9-]+)\]\]$/;

/** Pattern for `elements:` line (comma-separated `[[id]]` list) */
const ELEMENTS_LINE_RE = /^- elements:\s*(.+)$/;

/** Extract `[[id]]` values from a comma-separated list string. */
const ELEMENTS_LIST_RE = /\[\[([a-z0-9-]+)\]\]/g;

/**
 * Pattern for perm operation line: `- <operation>: [[act-id]](, [[act-id]])*`
 * operation is a token without whitespace or `:`.
 * The actor list must start with `[[` to distinguish from plain bullet points.
 */
const PERM_OPERATION_LINE_RE = /^- ([^\s:]+): (\[\[.+)$/;

/** Extract `[[id]]` actor references from an operation actor list string. */
const PERM_ACTOR_REF_RE = /\[\[([a-z0-9-]+)\]\]/g;

/** Pattern for perm target line: `対象: [[id]]` */
const PERM_TARGET_LINE_RE = /^対象: \[\[([a-z0-9-]+)\]\]$/;

export interface StructuredLineResult {
  dependencyEdges: DependencyEdge[];
  /** IDs listed in `## 登場要素` sections (keyed by file path). */
  actorIds: { id: string; file: string; line: number }[];
  /** Values from `責務:` lines. */
  responsibilities: { value: string; file: string; line: number }[];
  /** Values from `実装:` lines (as comma-split path arrays). */
  implementations: { paths: string[]; file: string; line: number }[];
  /** IDs from `elements:` lines. */
  elementItems: { id: string; file: string; line: number }[];
  /** Operation lines from perm elements. */
  permOperations: PermOperation[];
  /** Target lines from perm elements (`対象:` lines). */
  permTargets: PermTarget[];
}

/**
 * Extract structured lines from file content.
 *
 * @param content  Raw file content.
 * @param filePath Used for position information.
 */
export function extractStructuredLines(
  content: string,
  filePath: string
): StructuredLineResult {
  const lines = content.split("\n");
  const dependencyEdges: DependencyEdge[] = [];
  const actorIds: StructuredLineResult["actorIds"] = [];
  const responsibilities: StructuredLineResult["responsibilities"] = [];
  const implementations: StructuredLineResult["implementations"] = [];
  const elementItems: StructuredLineResult["elementItems"] = [];
  const permOperations: PermOperation[] = [];
  const permTargets: PermTarget[] = [];

  let inCodeFence = false;
  let inActorsSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNumber = i + 1; // 1-based

    // Code fence toggle
    if (line.trimStart().startsWith("```")) {
      inCodeFence = !inCodeFence;
      inActorsSection = false; // fence resets section context
      continue;
    }
    if (inCodeFence) continue;

    // Section tracking: `## 登場要素` starts the actor section; any other `## ` ends it
    if (line === "## 登場要素") {
      inActorsSection = true;
      continue;
    }
    if (/^## /.test(line)) {
      inActorsSection = false;
      // Fall through — may be a heading element, but that's handled by declarations.ts
    }

    // `## 登場要素` items
    if (inActorsSection) {
      const itemMatch = ELEMENT_ITEM_RE.exec(line);
      if (itemMatch) {
        actorIds.push({ id: itemMatch[1]!, file: filePath, line: lineNumber });
      }
      continue;
    }

    // Dependency edge: `- [[a]] -> [[b]]`
    const depMatch = DEP_EDGE_RE.exec(line);
    if (depMatch) {
      dependencyEdges.push({
        from: depMatch[1]!,
        to: depMatch[2]!,
        file: filePath,
        line: lineNumber,
      });
      continue;
    }

    // `責務:` line
    if (line.startsWith("責務:")) {
      responsibilities.push({
        value: line.slice("責務:".length).trim(),
        file: filePath,
        line: lineNumber,
      });
      continue;
    }

    // `実装:` line
    if (line.startsWith("実装:")) {
      const raw = line.slice("実装:".length).trim();
      const paths = raw
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p !== "");
      implementations.push({ paths, file: filePath, line: lineNumber });
      continue;
    }

    // `- elements: [[id1]], [[id2]], ...`
    const elementsLineMatch = ELEMENTS_LINE_RE.exec(line);
    if (elementsLineMatch) {
      const listStr = elementsLineMatch[1]!;
      let m: RegExpExecArray | null;
      ELEMENTS_LIST_RE.lastIndex = 0;
      while ((m = ELEMENTS_LIST_RE.exec(listStr)) !== null) {
        elementItems.push({ id: m[1]!, file: filePath, line: lineNumber });
      }
      continue;
    }

    // Perm operation line: `- <operation>: [[act-id]](, [[act-id]])*`
    const permOpMatch = PERM_OPERATION_LINE_RE.exec(line);
    if (permOpMatch) {
      const operation = permOpMatch[1]!;
      const actorList = permOpMatch[2]!;
      const actorIds: string[] = [];
      let m: RegExpExecArray | null;
      PERM_ACTOR_REF_RE.lastIndex = 0;
      while ((m = PERM_ACTOR_REF_RE.exec(actorList)) !== null) {
        actorIds.push(m[1]!);
      }
      permOperations.push({ operation, actorIds, file: filePath, line: lineNumber });
      continue;
    }

    // Perm target line: `対象: [[id]]`
    const permTargetMatch = PERM_TARGET_LINE_RE.exec(line);
    if (permTargetMatch) {
      permTargets.push({ targetId: permTargetMatch[1]!, file: filePath, line: lineNumber });
      continue;
    }
  }

  return {
    dependencyEdges,
    actorIds,
    responsibilities,
    implementations,
    elementItems,
    permOperations,
    permTargets,
  };
}
