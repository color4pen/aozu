/**
 * Ruleset generator (mod-export).
 *
 * `generateRuleset` is a pure function: no file I/O.
 * Produces the spec/format.md §11 JSON schema from a Graph.
 */

import type { Graph } from "../graph/types.ts";
import type { Element } from "../graph/index.ts";
import type { Ruleset, ExportDiagnostic, GenerateResult } from "./types.ts";

/**
 * Generate a ruleset JSON from the given graph.
 *
 * Algorithm:
 * 1. Collect all `mod` elements from `graph.elements`.
 * 2. Associate each `実装:` entry in `graph.implementations` with the nearest
 *    preceding `mod` element (by line number, same file).
 * 3. If any `mod` element has no associated `実装:` entry, return diagnostics.
 * 4. Build and JSON-serialize the ruleset with stable ordering.
 *
 * @returns `{ json, diagnostics: [] }` on success,
 *          `{ json: null, diagnostics }` when `実装:` lines are missing.
 */
export function generateRuleset(graph: Graph): GenerateResult {
  // 1. Collect all mod elements.
  const modElements: Element[] = [];
  for (const [, el] of graph.elements) {
    if (el.prefix === "mod") {
      modElements.push(el);
    }
  }

  // Group mod elements by file for efficient lookup.
  const modsByFile = new Map<string, Element[]>();
  for (const el of modElements) {
    const arr = modsByFile.get(el.file) ?? [];
    arr.push(el);
    modsByFile.set(el.file, arr);
  }

  // 2. Associate each `実装:` line with the nearest preceding mod element.
  //    Key: mod element ID, Value: collected paths.
  const modToPaths = new Map<string, string[]>();
  for (const el of modElements) {
    modToPaths.set(el.id, []);
  }

  for (const impl of graph.implementations) {
    const modsInFile = modsByFile.get(impl.file) ?? [];
    // Find the mod element in the same file with the largest line number
    // that is still ≤ the implementation line number.
    let nearestMod: Element | null = null;
    for (const mod of modsInFile) {
      if (mod.line <= impl.line) {
        if (!nearestMod || mod.line > nearestMod.line) {
          nearestMod = mod;
        }
      }
    }
    if (nearestMod) {
      const paths = modToPaths.get(nearestMod.id) ?? [];
      paths.push(...impl.paths);
      modToPaths.set(nearestMod.id, paths);
    }
  }

  // 3. Check for missing `実装:` lines.
  const diagnostics: ExportDiagnostic[] = [];
  for (const el of modElements) {
    const paths = modToPaths.get(el.id) ?? [];
    if (paths.length === 0) {
      diagnostics.push({
        level: "error",
        code: "E001",
        moduleId: el.id,
        message: `module '${el.id}' is missing an 実装: line`,
      });
    }
  }

  if (diagnostics.length > 0) {
    return { json: null, diagnostics };
  }

  // 4. Build ruleset with stable ordering.

  // `modules`: mod IDs in lexicographic order.
  const modules = modElements.map((el) => el.id).sort();

  // `paths`: keys in `modules` order.
  const paths: Record<string, string[]> = {};
  for (const id of modules) {
    paths[id] = modToPaths.get(id) ?? [];
  }

  // `allowed`: all dependency edges as [from, to] pairs, sorted by from then to.
  const allowed: [string, string][] = graph.dependencyEdges.map((edge) => [
    edge.from,
    edge.to,
  ]);
  allowed.sort((a, b) => {
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return 1;
    if (a[1] < b[1]) return -1;
    if (a[1] > b[1]) return 1;
    return 0;
  });

  const ruleset: Ruleset = {
    "format-version": 0,
    modules,
    paths,
    allowed,
  };

  const json = JSON.stringify(ruleset, null, 2) + "\n";
  return { json, diagnostics: [] };
}
