import { describe, expect, it } from "bun:test";
import { runCheck } from "./checker.ts";
import { buildGraph } from "../graph/builder.ts";
import type { ParseResult } from "../parse/types.ts";
import type { Manifest } from "../graph/types.ts";

function makeGraph(overrides: Partial<ParseResult> = {}) {
  const parsed: ParseResult = {
    elements: [],
    references: [],
    dependencyEdges: [],
    diagnostics: [],
    frontmatters: new Map(),
    actorIds: [],
    elementItems: [],
    implementations: [],
    ...overrides,
  };
  return buildGraph(parsed);
}

const manifest = (enabled: string[]): Manifest => ({ formatVersion: "0", enabled });

describe("runCheck: aggregation and graceful degradation", () => {
  it("valid static graph with no violations → no diagnostics", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "mod-parse", prefix: "mod", displayName: "Parser", file: "modules.md", line: 5 },
      ],
      dependencyEdges: [
        { from: "mod-cli", to: "mod-parse", file: "dependencies.md", line: 1 },
      ],
    });
    const diags = runCheck(graph, manifest(["static"]));
    expect(diags).toHaveLength(0);
  });

  it("TC-051: multiple rule violations → all violations are reported (no fail-fast)", () => {
    // C1: invalid ID, C2: duplicate ID
    const graph = makeGraph({
      elements: [
        { id: "Mod-Parse", prefix: "Mod", displayName: "Bad", file: "a.md", line: 1 },
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "b.md", line: 1 },
        { id: "mod-cli", prefix: "mod", displayName: "CLI dup", file: "c.md", line: 1 },
      ],
    });
    const diags = runCheck(graph, manifest(["static"]));
    const codes = diags.map((d) => d.code);
    expect(codes).toContain("C1");
    expect(codes).toContain("C2");
  });

  it("enabled: static only → C5, C8, C9, C10 are skipped", () => {
    // Include a seq element that would trigger C5 if evaluated
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "seq-foo", prefix: "seq", displayName: "Foo Seq", file: "dynamic/foo.md", line: 1 },
      ],
    });
    const diags = runCheck(graph, manifest(["static"]));
    const codes = diags.map((d) => d.code);
    // C5 should not appear (dynamic not enabled)
    expect(codes).not.toContain("C5");
    // C8, C9, C10 should not appear (loop not enabled)
    expect(codes).not.toContain("C8");
    expect(codes).not.toContain("C9");
    expect(codes).not.toContain("C10");
  });

  it("C4 is evaluated when static is enabled", () => {
    // Non-mod endpoint should trigger C4
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "ent-order", prefix: "ent", displayName: "Order", file: "model.md", line: 1 },
      ],
      dependencyEdges: [
        { from: "ent-order", to: "mod-cli", file: "dependencies.md", line: 1 },
      ],
    });
    const diags = runCheck(graph, manifest(["static", "domain"]));
    expect(diags.some((d) => d.code === "C4")).toBe(true);
  });

  it("C6 is evaluated when view type is in enabled", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      ],
    });
    const diags = runCheck(graph, manifest(["static", "use-case"]));
    expect(diags.some((d) => d.code === "C6")).toBe(true);
  });

  it("C7 is evaluated for invalid prerequisite combination", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      ],
    });
    // loop without static is a C7 violation
    const diags = runCheck(graph, manifest(["loop"]));
    expect(diags.some((d) => d.code === "C7")).toBe(true);
  });

  it("C8, C9, C10 are evaluated when loop is enabled", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "adr-0001-x", prefix: "adr", displayName: "ADR 0001", file: "adr/0001.md", line: 1 },
      ],
    });
    // C9: adr without top-* reference (no references)
    // C8: stale key "ent-deleted"
    const diags = runCheck(graph, manifest(["static", "loop"]), ["ent-deleted"]);
    expect(diags.some((d) => d.code === "C8")).toBe(true);
    expect(diags.some((d) => d.code === "C9")).toBe(true);
  });
});
