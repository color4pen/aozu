/**
 * Graceful degradation tests.
 *
 * Verifies that rules for disabled layers are not evaluated, and that
 * view type fail-closed behavior works correctly.
 */

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

// ---------------------------------------------------------------------------
// T-19: Graceful degradation — enabled: static only
// ---------------------------------------------------------------------------

describe("T-19: degradation — enabled: static only", () => {
  it("C5 (seq actors) is not evaluated when dynamic is disabled", () => {
    // A seq element with no actors would trigger C5 if dynamic were enabled
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "seq-order", prefix: "seq", displayName: "Order", file: "dynamic/order.md", line: 1 },
      ],
      actorIds: [], // empty actors for seq-order
    });
    const diags = runCheck(graph, manifest(["static"]));
    expect(diags.map((d) => d.code)).not.toContain("C5");
  });

  it("C8 (state keys) is not evaluated when loop is disabled", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      ],
    });
    // stale key would trigger C8 if loop were enabled
    const diags = runCheck(graph, manifest(["static"]), ["ent-deleted"]);
    expect(diags.map((d) => d.code)).not.toContain("C8");
  });

  it("C9 (adr topics) is not evaluated when loop is disabled", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "adr-0001-x", prefix: "adr", displayName: "ADR", file: "adr/0001.md", line: 1 },
      ],
      references: [], // no top references → would trigger C9 if loop enabled
    });
    const diags = runCheck(graph, manifest(["static"]));
    expect(diags.map((d) => d.code)).not.toContain("C9");
  });

  it("C10 (plan elements) is not evaluated when loop is disabled", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "plan-rework", prefix: "plan", displayName: "Rework", file: "plans/rework.md", line: 1 },
      ],
      elementItems: [
        { id: "ent-nonexistent", file: "plans/rework.md", line: 5 },
      ],
    });
    const diags = runCheck(graph, manifest(["static"]));
    expect(diags.map((d) => d.code)).not.toContain("C10");
  });

  it("C4 (dependency edges) IS evaluated when static is enabled", () => {
    // Non-mod endpoint triggers C4
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

  it("C3 does not flag domain references when domain is disabled", () => {
    // mod-cli references term-closure, but domain is not enabled
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        // term-closure is declared but domain is disabled
        { id: "term-closure", prefix: "term", displayName: "Closure", file: "glossary.md", line: 1 },
      ],
      references: [
        // Reference from enabled (mod) to disabled (term) — should be skipped
        { targetId: "term-closure", file: "modules.md", line: 3 },
      ],
    });
    const diags = runCheck(graph, manifest(["static"]));
    // term prefix not in enabled prefixes → no C3 for that reference
    expect(diags.map((d) => d.code)).not.toContain("C3");
  });

  it("C11 does not flag references from disabled-layer elements", () => {
    // seq-order references mod-cli — seq is disabled layer
    const graph = makeGraph({
      elements: [
        { id: "seq-order", prefix: "seq", displayName: "Order", file: "dynamic/order.md", line: 1 },
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      ],
      references: [
        { targetId: "mod-cli", file: "dynamic/order.md", line: 5 },
      ],
    });
    // Only static enabled → seq elements' references not checked
    const diags = runCheck(graph, manifest(["static"]));
    expect(diags.map((d) => d.code)).not.toContain("C11");
  });

  it("static-only fixture with only mod/adr elements → no diagnostics", () => {
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
});

// ---------------------------------------------------------------------------
// T-20: View type fail-closed
// ---------------------------------------------------------------------------

describe("T-20: view type fail-closed", () => {
  it("enabled: static, domain, use-case → C6 diagnostic for use-case", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      ],
    });
    const diags = runCheck(graph, manifest(["static", "domain", "use-case"]));
    const c6 = diags.filter((d) => d.code === "C6");
    expect(c6).toHaveLength(1);
    expect(c6[0]!.message).toContain("unsupported view type");
    expect(c6[0]!.message).toContain("use-case");
  });

  it("multiple view types → one C6 per type", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      ],
    });
    const diags = runCheck(graph, manifest(["static", "use-case", "screen"]));
    const c6 = diags.filter((d) => d.code === "C6");
    expect(c6).toHaveLength(2);
  });

  it("no view types → no C6 diagnostic", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
      ],
    });
    const diags = runCheck(graph, manifest(["static", "domain", "dynamic"]));
    expect(diags.some((d) => d.code === "C6")).toBe(false);
  });
});
