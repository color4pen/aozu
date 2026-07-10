import { describe, expect, it } from "bun:test";
import { checkC3 } from "./c03-ref-resolved.ts";
import { buildGraph } from "../../graph/builder.ts";
import type { ParseResult } from "../../parse/types.ts";

function makeGraph(
  elements: ParseResult["elements"],
  references: ParseResult["references"]
) {
  const parsed: ParseResult = {
    elements,
    references,
    dependencyEdges: [],
    diagnostics: [],
    frontmatters: new Map(),
    actorIds: [],
    elementItems: [],
    implementations: [],
    permOperations: [],
    permTargets: [],
  };
  return buildGraph(parsed);
}

const ALL_PREFIXES = new Set(["mod", "term", "ent", "inv", "act", "seq", "top", "plan", "grp", "adr"]);
const STATIC_ONLY = new Set(["mod", "adr"]);

describe("checkC3: reference resolution", () => {
  it("all references resolved → no diagnostics", () => {
    const graph = makeGraph(
      [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "mod-parse", prefix: "mod", displayName: "Parser", file: "modules.md", line: 5 },
      ],
      [{ targetId: "mod-parse", file: "modules.md", line: 3 }]
    );
    expect(checkC3(graph, ALL_PREFIXES)).toHaveLength(0);
  });

  it("unresolved reference → C3 diagnostic", () => {
    const graph = makeGraph(
      [{ id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 }],
      [{ targetId: "mod-nonexistent", file: "modules.md", line: 3 }]
    );
    const diags = checkC3(graph, ALL_PREFIXES);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C3");
    expect(diags[0]!.elementId).toBe("mod-nonexistent");
    expect(diags[0]!.level).toBe("error");
  });

  it("reference to disabled-type element → no C3 diagnostic", () => {
    // seq-foo is declared but dynamic is not enabled
    const graph = makeGraph(
      [
        { id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 },
        { id: "seq-foo", prefix: "seq", displayName: "Foo", file: "foo.md", line: 1 },
      ],
      [{ targetId: "seq-foo", file: "modules.md", line: 3 }]
    );
    // Only static enabled → seq prefix is not in enabledPrefixes
    expect(checkC3(graph, STATIC_ONLY)).toHaveLength(0);
  });

  it("reference from disabled-layer element → no C3 diagnostic", () => {
    // seq-foo refers to mod-nonexistent, but seq layer is disabled
    const graph = makeGraph(
      [
        { id: "seq-foo", prefix: "seq", displayName: "Foo", file: "foo.md", line: 1 },
      ],
      [{ targetId: "mod-nonexistent", file: "foo.md", line: 5 }]
    );
    // Only static + adr enabled, so seq elements' obligations are not evaluated
    expect(checkC3(graph, STATIC_ONLY)).toHaveLength(0);
  });

  it("empty references → no diagnostics", () => {
    const graph = makeGraph(
      [{ id: "mod-cli", prefix: "mod", displayName: "CLI", file: "modules.md", line: 1 }],
      []
    );
    expect(checkC3(graph, ALL_PREFIXES)).toHaveLength(0);
  });

  it("unresolved act reference → C3 diagnostic", () => {
    const graph = makeGraph(
      [
        { id: "mod-workflow", prefix: "mod", displayName: "Workflow", file: "modules.md", line: 1 },
        // act-approver is NOT declared
      ],
      [{ targetId: "act-nonexistent", file: "modules.md", line: 3 }]
    );
    const diags = checkC3(graph, ALL_PREFIXES);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C3");
    expect(diags[0]!.elementId).toBe("act-nonexistent");
    expect(diags[0]!.level).toBe("error");
  });

  it("resolved act reference → no C3 diagnostic", () => {
    const graph = makeGraph(
      [
        { id: "mod-workflow", prefix: "mod", displayName: "Workflow", file: "modules.md", line: 1 },
        { id: "act-approver", prefix: "act", displayName: "Approver", file: "actors.md", line: 1 },
      ],
      [{ targetId: "act-approver", file: "modules.md", line: 3 }]
    );
    expect(checkC3(graph, ALL_PREFIXES)).toHaveLength(0);
  });

  // --- fail-closed: unknown prefix ---

  it("unknown prefix reference ([[zzz-typo]]) with enabled:static → C3 diagnostic (fail-closed)", () => {
    // zzz is not in KNOWN_PREFIXES; it must always be diagnosed regardless of enabledPrefixes
    const graph = makeGraph(
      [{ id: "mod-intake", prefix: "mod", displayName: "Intake", file: "modules.md", line: 1 }],
      [{ targetId: "zzz-typo", file: "modules.md", line: 5 }]
    );
    const enabledStatic = new Set(["mod", "adr"]);
    const diags = checkC3(graph, enabledStatic);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C3");
    expect(diags[0]!.level).toBe("error");
    expect(diags[0]!.message).toContain("zzz-typo");
    expect(diags[0]!.message).toContain('(unknown prefix "zzz")');
  });

  // --- fail-closed: source with unknown prefix → degenerate skip not applied ---

  it("reference from unknown-prefix source (zzz-bad) → degenerate skip NOT applied, C3 raised", () => {
    // zzz is not in KNOWN_PREFIXES; source-side degenerate skip requires KNOWN prefix → skip is not triggered
    const graph = makeGraph(
      [{ id: "zzz-bad", prefix: "zzz", displayName: "Bad", file: "zzz.md", line: 1 }],
      [{ targetId: "mod-nonexist", file: "zzz.md", line: 5 }]
    );
    const enabledStatic = new Set(["mod", "adr"]);
    const diags = checkC3(graph, enabledStatic);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C3");
    expect(diags[0]!.level).toBe("error");
  });

  // --- degenerate skip maintained: known but disabled prefix ---

  it("known but disabled prefix reference ([[ent-x]]) with enabled:static → no C3 diagnostic (縮退維持)", () => {
    // ent is a KNOWN prefix but not in the static enabledPrefixes set
    const graph = makeGraph(
      [{ id: "mod-intake", prefix: "mod", displayName: "Intake", file: "modules.md", line: 1 }],
      [{ targetId: "ent-x", file: "modules.md", line: 5 }]
    );
    const enabledStatic = new Set(["mod", "adr"]);
    expect(checkC3(graph, enabledStatic)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// T-12: perm / permission C3 tests
// ---------------------------------------------------------------------------

describe("checkC3: perm references with permission enabled", () => {
  const PERM_ENABLED = new Set(["mod", "term", "ent", "inv", "act", "adr", "perm"]);

  it("permission enabled + existing act reference → no C3 diagnostic", () => {
    const graph = makeGraph(
      [
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
        { id: "act-admin", prefix: "act", displayName: "Admin", file: "domain/actors.md", line: 1 },
      ],
      [{ targetId: "act-admin", file: "views/permission/deal.md", line: 3 }]
    );
    expect(checkC3(graph, PERM_ENABLED)).toHaveLength(0);
  });

  it("permission enabled + non-existent act reference → C3 diagnostic", () => {
    const graph = makeGraph(
      [
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
        // act-nonexistent is NOT declared
      ],
      [{ targetId: "act-nonexistent", file: "views/permission/deal.md", line: 3 }]
    );
    const diags = checkC3(graph, PERM_ENABLED);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C3");
    expect(diags[0]!.elementId).toBe("act-nonexistent");
  });

  it("permission NOT enabled + perm reference → no C3 diagnostic (縮退)", () => {
    const graph = makeGraph(
      [
        { id: "mod-workflow", prefix: "mod", displayName: "Workflow", file: "modules.md", line: 1 },
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
      ],
      [{ targetId: "perm-deal", file: "modules.md", line: 3 }]
    );
    // perm NOT in enabledPrefixes
    expect(checkC3(graph, ALL_PREFIXES)).toHaveLength(0);
  });
});
