import { describe, expect, it } from "bun:test";
import { buildGraph, resolveId } from "./builder.ts";
import type { ParseResult } from "../parse/types.ts";

function makeEmptyParseResult(): ParseResult {
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
  };
}

describe("buildGraph", () => {
  it("builds a graph from a simple ParseResult", () => {
    const parsed = makeEmptyParseResult();
    parsed.elements.push(
      { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      { id: "mod-parse", prefix: "mod", displayName: "Parser", file: "modules.md", line: 5 }
    );
    const graph = buildGraph(parsed, "manifest.md");
    expect(graph.elements.size).toBe(2);
    expect(graph.rawElements).toHaveLength(2);
    expect(graph.manifestPath).toBe("manifest.md");
  });

  it("empty ParseResult produces empty Graph", () => {
    const graph = buildGraph(makeEmptyParseResult(), null);
    expect(graph.elements.size).toBe(0);
    expect(graph.rawElements).toHaveLength(0);
    expect(graph.references.all).toHaveLength(0);
    expect(graph.dependencyEdges).toHaveLength(0);
    expect(graph.actorIds).toHaveLength(0);
    expect(graph.elementItems).toHaveLength(0);
    expect(graph.manifestPath).toBeNull();
  });

  it("resolveId returns Element for known ID", () => {
    const parsed = makeEmptyParseResult();
    parsed.elements.push(
      { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 }
    );
    const graph = buildGraph(parsed);
    const el = resolveId(graph, "mod-cli");
    expect(el).toBeDefined();
    expect(el!.id).toBe("mod-cli");
    expect(el!.prefix).toBe("mod");
  });

  it("resolveId returns undefined for unknown ID", () => {
    const parsed = makeEmptyParseResult();
    parsed.elements.push(
      { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 }
    );
    const graph = buildGraph(parsed);
    expect(resolveId(graph, "mod-nonexistent")).toBeUndefined();
  });

  it("byTarget index provides references to a specific ID", () => {
    const parsed = makeEmptyParseResult();
    parsed.elements.push(
      { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "a.md", line: 1 },
      { id: "mod-parse", prefix: "mod", displayName: "Parser", file: "b.md", line: 1 }
    );
    parsed.references.push(
      { targetId: "mod-parse", file: "a.md", line: 3 },
      { targetId: "mod-parse", file: "b.md", line: 5 },
      { targetId: "mod-cli", file: "b.md", line: 6 }
    );
    const graph = buildGraph(parsed);
    const refs = graph.references.byTarget.get("mod-parse");
    expect(refs).toHaveLength(2);
    expect(refs!.map((r) => r.file)).toContain("a.md");
    expect(refs!.map((r) => r.file)).toContain("b.md");
  });

  it("bySource index provides references from a specific file", () => {
    const parsed = makeEmptyParseResult();
    parsed.references.push(
      { targetId: "mod-parse", file: "a.md", line: 3 },
      { targetId: "mod-graph", file: "a.md", line: 4 },
      { targetId: "mod-cli", file: "b.md", line: 1 }
    );
    const graph = buildGraph(parsed);
    const refsFromA = graph.references.bySource.get("a.md");
    expect(refsFromA).toHaveLength(2);
    const refsFromB = graph.references.bySource.get("b.md");
    expect(refsFromB).toHaveLength(1);
  });

  it("copies implementations from ParseResult to Graph", () => {
    const parsed = makeEmptyParseResult();
    parsed.implementations.push(
      { paths: ["src/cli/"], file: "modules.md", line: 3 },
      { paths: ["src/parse/", "src/extra/"], file: "modules.md", line: 7 }
    );
    const graph = buildGraph(parsed);
    expect(graph.implementations).toHaveLength(2);
    expect(graph.implementations[0]!.paths).toEqual(["src/cli/"]);
    expect(graph.implementations[1]!.paths).toEqual(["src/parse/", "src/extra/"]);
    // Ensure shallow copy (not same reference)
    expect(graph.implementations).not.toBe(parsed.implementations);
  });

  it("rawElements preserves duplicates for C2 detection", () => {
    const parsed = makeEmptyParseResult();
    parsed.elements.push(
      { id: "mod-cli", prefix: "mod", displayName: "CLI v1", file: "a.md", line: 1 },
      { id: "mod-cli", prefix: "mod", displayName: "CLI v2", file: "b.md", line: 1 }
    );
    const graph = buildGraph(parsed);
    // elements Map deduplicates (last wins)
    expect(graph.elements.size).toBe(1);
    expect(graph.elements.get("mod-cli")!.displayName).toBe("CLI v2");
    // rawElements preserves both
    expect(graph.rawElements).toHaveLength(2);
  });
});
