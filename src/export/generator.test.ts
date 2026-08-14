/**
 * Tests for generateRuleset (mod-export).
 *
 * Verifies spec/format.md §11 schema compliance, deterministic output,
 * and diagnostic generation for missing 実装: lines.
 */

import { describe, expect, it } from "bun:test";
import { generateRuleset } from "./generator.ts";
import { buildGraph } from "../graph/builder.ts";
import type { ParseResult } from "../parse/types.ts";

/** Helper: create a minimal ParseResult. */
function makeParseResult(overrides: Partial<ParseResult> = {}): ParseResult {
  return {
    elements: [],
    references: [],
    dependencyEdges: [],
    diagnostics: [],
    frontmatters: new Map(),
    actorIds: [],
    elementItems: [],
    implementations: [],
    permOperations: [],
    targetLines: [],
    malformedPermOperations: [],
    ...overrides,
  };
}

/** Helper: create a mod element at the given line. */
function modEl(id: string, file: string, line: number) {
  return { id, prefix: "mod", displayName: id, file, line };
}

describe("generateRuleset", () => {
  it("generates valid ruleset from a simple graph with 2 mods", () => {
    const parsed = makeParseResult({
      elements: [
        modEl("mod-cli", "modules.md", 1),
        modEl("mod-parse", "modules.md", 5),
      ],
      dependencyEdges: [
        { from: "mod-cli", to: "mod-parse", file: "deps.md", line: 1 },
      ],
      implementations: [
        { paths: ["src/cli/"], file: "modules.md", line: 3 },
        { paths: ["src/parse/"], file: "modules.md", line: 7 },
      ],
    });
    const graph = buildGraph(parsed);
    const result = generateRuleset(graph);

    expect(result.diagnostics).toHaveLength(0);
    expect(result.json).not.toBeNull();

    const ruleset = JSON.parse(result.json!);
    expect(ruleset["format-version"]).toBe(0);
    expect(ruleset.modules).toEqual(["mod-cli", "mod-parse"]);
    expect(ruleset.paths["mod-cli"]).toEqual(["src/cli/"]);
    expect(ruleset.paths["mod-parse"]).toEqual(["src/parse/"]);
    expect(ruleset.allowed).toEqual([["mod-cli", "mod-parse"]]);
  });

  it("modules array is in lexicographic (dictionary) order", () => {
    const parsed = makeParseResult({
      elements: [
        modEl("mod-state", "modules.md", 1),
        modEl("mod-check", "modules.md", 5),
        modEl("mod-cli", "modules.md", 9),
        modEl("mod-export", "modules.md", 13),
      ],
      implementations: [
        { paths: ["src/state/"], file: "modules.md", line: 3 },
        { paths: ["src/check/"], file: "modules.md", line: 7 },
        { paths: ["src/cli/"], file: "modules.md", line: 11 },
        { paths: ["src/export/"], file: "modules.md", line: 15 },
      ],
    });
    const graph = buildGraph(parsed);
    const result = generateRuleset(graph);

    expect(result.json).not.toBeNull();
    const ruleset = JSON.parse(result.json!);
    const sorted = [...ruleset.modules].sort();
    expect(ruleset.modules).toEqual(sorted);
  });

  it("allowed array is sorted by from asc, then to asc", () => {
    const parsed = makeParseResult({
      elements: [
        modEl("mod-cli", "modules.md", 1),
        modEl("mod-check", "modules.md", 5),
        modEl("mod-graph", "modules.md", 9),
        modEl("mod-parse", "modules.md", 13),
      ],
      dependencyEdges: [
        { from: "mod-cli", to: "mod-parse", file: "deps.md", line: 3 },
        { from: "mod-check", to: "mod-graph", file: "deps.md", line: 1 },
        { from: "mod-cli", to: "mod-graph", file: "deps.md", line: 2 },
        { from: "mod-cli", to: "mod-check", file: "deps.md", line: 4 },
        { from: "mod-graph", to: "mod-parse", file: "deps.md", line: 5 },
      ],
      implementations: [
        { paths: ["src/cli/"], file: "modules.md", line: 3 },
        { paths: ["src/check/"], file: "modules.md", line: 7 },
        { paths: ["src/graph/"], file: "modules.md", line: 11 },
        { paths: ["src/parse/"], file: "modules.md", line: 15 },
      ],
    });
    const graph = buildGraph(parsed);
    const result = generateRuleset(graph);

    expect(result.json).not.toBeNull();
    const ruleset = JSON.parse(result.json!);
    expect(ruleset.allowed).toEqual([
      ["mod-check", "mod-graph"],
      ["mod-cli", "mod-check"],
      ["mod-cli", "mod-graph"],
      ["mod-cli", "mod-parse"],
      ["mod-graph", "mod-parse"],
    ]);
  });

  it("produces identical byte strings for the same input (deterministic)", () => {
    const parsed = makeParseResult({
      elements: [
        modEl("mod-cli", "modules.md", 1),
        modEl("mod-parse", "modules.md", 5),
      ],
      dependencyEdges: [
        { from: "mod-cli", to: "mod-parse", file: "deps.md", line: 1 },
      ],
      implementations: [
        { paths: ["src/cli/"], file: "modules.md", line: 3 },
        { paths: ["src/parse/"], file: "modules.md", line: 7 },
      ],
    });

    const graph1 = buildGraph(parsed);
    const result1 = generateRuleset(graph1);

    const graph2 = buildGraph(parsed);
    const result2 = generateRuleset(graph2);

    expect(result1.json).toBe(result2.json);
  });

  it("returns json: null and diagnostics when a mod is missing 実装: line", () => {
    const parsed = makeParseResult({
      elements: [
        modEl("mod-cli", "modules.md", 1),
        modEl("mod-parse", "modules.md", 5),
      ],
      // No implementations provided → both mods are missing 実装: lines
    });
    const graph = buildGraph(parsed);
    const result = generateRuleset(graph);

    expect(result.json).toBeNull();
    expect(result.diagnostics.length).toBeGreaterThan(0);
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toContain("E001");
    const moduleIds = result.diagnostics.map((d) => d.moduleId);
    expect(moduleIds).toContain("mod-cli");
    expect(moduleIds).toContain("mod-parse");
  });

  it("returns json: null and diagnostic for the specific missing mod", () => {
    const parsed = makeParseResult({
      elements: [
        modEl("mod-cli", "modules.md", 1),
        modEl("mod-parse", "modules.md", 5),
      ],
      implementations: [
        // Only mod-cli has an implementation; mod-parse does not
        { paths: ["src/cli/"], file: "modules.md", line: 3 },
      ],
    });
    const graph = buildGraph(parsed);
    const result = generateRuleset(graph);

    expect(result.json).toBeNull();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.moduleId).toBe("mod-parse");
    expect(result.diagnostics[0]!.code).toBe("E001");
  });

  it("handles graph with zero mod elements (empty design)", () => {
    const parsed = makeParseResult({});
    const graph = buildGraph(parsed);
    const result = generateRuleset(graph);

    expect(result.diagnostics).toHaveLength(0);
    expect(result.json).not.toBeNull();
    const ruleset = JSON.parse(result.json!);
    expect(ruleset["format-version"]).toBe(0);
    expect(ruleset.modules).toEqual([]);
    expect(ruleset.paths).toEqual({});
    expect(ruleset.allowed).toEqual([]);
  });

  it("JSON output ends with a trailing newline", () => {
    const parsed = makeParseResult({
      elements: [modEl("mod-cli", "modules.md", 1)],
      implementations: [{ paths: ["src/cli/"], file: "modules.md", line: 3 }],
    });
    const graph = buildGraph(parsed);
    const result = generateRuleset(graph);

    expect(result.json).not.toBeNull();
    expect(result.json!.endsWith("\n")).toBe(true);
  });
});
