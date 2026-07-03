/**
 * Unit tests for verifyCoverage (T-02).
 *
 * Uses in-memory Graph and StateMap fixtures (no disk I/O).
 */

import { describe, it, expect } from "bun:test";
import { verifyCoverage } from "./coverage.ts";
import type { CoverageResult, GroupGraph } from "./coverage.ts";
import type { Graph } from "../graph/types.ts";
import type { StateMap } from "../state/types.ts";

// ---------------------------------------------------------------------------
// Minimal Graph fixture
// ---------------------------------------------------------------------------

/**
 * Build a minimal Graph for testing.
 * Only the fields used by verifyCoverage are populated.
 */
function makeGraph(
  elements: Array<{ id: string; prefix: string; file: string; line: number }>,
  references: Array<{ targetId: string; file: string; line: number }> = []
): Graph {
  const elementMap = new Map(
    elements.map((el) => [
      el.id,
      {
        id: el.id,
        prefix: el.prefix,
        displayName: el.id,
        file: el.file,
        line: el.line,
      },
    ])
  );

  const bySource = new Map<string, typeof references>();
  for (const ref of references) {
    const existing = bySource.get(ref.file) ?? [];
    existing.push(ref);
    bySource.set(ref.file, existing);
  }

  return {
    elements: elementMap,
    rawElements: elements.map((el) => ({
      id: el.id,
      prefix: el.prefix,
      displayName: el.id,
      file: el.file,
      line: el.line,
    })),
    references: {
      bySource,
      byTarget: new Map(),
      all: references,
    },
    dependencyEdges: [],
    actorIds: [],
    elementItems: [],
    implementations: [],
    manifestPath: null,
  };
}

/** Build an empty GroupGraph (no groups, no after: edges). */
function makeEmptyGroupGraph(): GroupGraph {
  return {
    groupElements: new Map(),
    afterEdges: new Set(),
  };
}

/** Build a GroupGraph with one group containing the given elements. */
function makeGroupGraph(
  groupId: string,
  elementIds: string[],
  afterEdges: string[] = []
): GroupGraph {
  return {
    groupElements: new Map([[groupId, new Set(elementIds)]]),
    afterEdges: new Set(afterEdges),
  };
}

// ---------------------------------------------------------------------------
// T-02a: All elements covered → pass = true
// ---------------------------------------------------------------------------

describe("verifyCoverage — all elements covered", () => {
  it("returns pass = true when all elements are cited in draftRefs", () => {
    const graph = makeGraph([
      { id: "mod-cli", prefix: "mod", file: "static/modules.md", line: 3 },
      { id: "mod-core", prefix: "mod", file: "static/modules.md", line: 6 },
    ]);
    const draftRefs = new Set(["mod-cli", "mod-core"]);
    const stateMap: StateMap = {};
    const groupGraph = makeGroupGraph("grp-my-group", ["mod-cli", "mod-core"]);

    const result = verifyCoverage(["mod-cli", "mod-core"], draftRefs, graph, stateMap, groupGraph);

    expect(result.pass).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// T-02b: Missing citation → pass = false, missing ID in errors
// ---------------------------------------------------------------------------

describe("verifyCoverage — missing citation", () => {
  it("returns pass = false and errors contain the missing ID", () => {
    const graph = makeGraph([
      { id: "mod-cli", prefix: "mod", file: "static/modules.md", line: 3 },
      { id: "mod-core", prefix: "mod", file: "static/modules.md", line: 6 },
    ]);
    // Only mod-cli is cited, mod-core is missing
    const draftRefs = new Set(["mod-cli"]);
    const stateMap: StateMap = {};
    const groupGraph = makeGroupGraph("grp-my-group", ["mod-cli", "mod-core"]);

    const result = verifyCoverage(["mod-cli", "mod-core"], draftRefs, graph, stateMap, groupGraph);

    expect(result.pass).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    const missingError = result.errors.find((e) => e.elementId === "mod-core");
    expect(missingError).toBeDefined();
    expect(missingError?.code).toBe("NOT_COVERED");
  });

  it("errors list the specific missing element ID", () => {
    const graph = makeGraph([
      { id: "ent-order", prefix: "ent", file: "domain/model.md", line: 3 },
      { id: "ent-product", prefix: "ent", file: "domain/model.md", line: 10 },
      { id: "mod-cli", prefix: "mod", file: "static/modules.md", line: 3 },
    ]);
    const draftRefs = new Set(["ent-order", "mod-cli"]); // ent-product missing
    const stateMap: StateMap = {};
    const groupGraph = makeGroupGraph("grp-g1", ["ent-order", "ent-product", "mod-cli"]);

    const result = verifyCoverage(
      ["ent-order", "ent-product", "mod-cli"],
      draftRefs,
      graph,
      stateMap,
      groupGraph
    );

    expect(result.pass).toBe(false);
    const ids = result.errors.map((e) => e.elementId);
    expect(ids).toContain("ent-product");
    expect(ids).not.toContain("ent-order");
    expect(ids).not.toContain("mod-cli");
  });
});

// ---------------------------------------------------------------------------
// T-02c: requested element → pass = false
// ---------------------------------------------------------------------------

describe("verifyCoverage — requested element in group", () => {
  it("returns pass = false when a group element is in requested state", () => {
    const graph = makeGraph([
      { id: "mod-cli", prefix: "mod", file: "static/modules.md", line: 3 },
    ]);
    const draftRefs = new Set(["mod-cli"]);
    const stateMap: StateMap = {
      "mod-cli": { state: "requested", request: "some-request" },
    };
    const groupGraph = makeGroupGraph("grp-g1", ["mod-cli"]);

    const result = verifyCoverage(["mod-cli"], draftRefs, graph, stateMap, groupGraph);

    expect(result.pass).toBe(false);
    expect(result.errors.find((e) => e.code === "WRONG_STATE")?.elementId).toBe("mod-cli");
  });
});

// ---------------------------------------------------------------------------
// T-02d: implemented element → pass = false
// ---------------------------------------------------------------------------

describe("verifyCoverage — implemented element in group", () => {
  it("returns pass = false when a group element is in implemented state", () => {
    const graph = makeGraph([
      { id: "mod-core", prefix: "mod", file: "static/modules.md", line: 6 },
    ]);
    const draftRefs = new Set(["mod-core"]);
    const stateMap: StateMap = {
      "mod-core": { state: "implemented", request: "old-request", pr: 10 },
    };
    const groupGraph = makeGroupGraph("grp-g1", ["mod-core"]);

    const result = verifyCoverage(["mod-core"], draftRefs, graph, stateMap, groupGraph);

    expect(result.pass).toBe(false);
    expect(result.errors.find((e) => e.code === "WRONG_STATE")?.elementId).toBe("mod-core");
  });
});

// ---------------------------------------------------------------------------
// T-02e: element not in graph → pass = false
// ---------------------------------------------------------------------------

describe("verifyCoverage — element not in graph", () => {
  it("returns pass = false when an element is not found in the graph", () => {
    // Graph has mod-cli but not mod-ghost
    const graph = makeGraph([
      { id: "mod-cli", prefix: "mod", file: "static/modules.md", line: 3 },
    ]);
    const draftRefs = new Set(["mod-cli", "mod-ghost"]);
    const stateMap: StateMap = {};
    const groupGraph = makeGroupGraph("grp-g1", ["mod-cli", "mod-ghost"]);

    const result = verifyCoverage(["mod-cli", "mod-ghost"], draftRefs, graph, stateMap, groupGraph);

    expect(result.pass).toBe(false);
    const notFoundError = result.errors.find((e) => e.code === "NOT_FOUND" && e.elementId === "mod-ghost");
    expect(notFoundError).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// T-02f: Cross-group reference + no after: → warning but pass = true
// ---------------------------------------------------------------------------

describe("verifyCoverage — cross-group reference warning", () => {
  it("produces a warning when elements cross group boundaries without after: constraint", () => {
    // Group A: mod-cli references mod-core which is in Group B
    // mod-cli file references mod-core
    const graph = makeGraph(
      [
        { id: "mod-cli", prefix: "mod", file: "static/modules.md", line: 3 },
        { id: "mod-core", prefix: "mod", file: "static/core.md", line: 3 },
      ],
      [
        { targetId: "mod-core", file: "static/modules.md", line: 5 },
      ]
    );
    const draftRefs = new Set(["mod-cli", "mod-core"]);
    const stateMap: StateMap = {};

    // Two groups, no after: edges
    const groupGraph: GroupGraph = {
      groupElements: new Map([
        ["grp-group-a", new Set(["mod-cli"])],
        ["grp-group-b", new Set(["mod-core"])],
      ]),
      afterEdges: new Set(),
    };

    const result = verifyCoverage(["mod-cli"], draftRefs, graph, stateMap, groupGraph);

    // Should have a warning, but pass = true (coverage is satisfied)
    expect(result.pass).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    const warning = result.warnings.find(
      (w) => w.code === "CROSS_GROUP_NO_ORDER" && w.elementId === "mod-cli"
    );
    expect(warning).toBeDefined();
  });

  it("does not warn when after: edge exists between the two groups", () => {
    const graph = makeGraph(
      [
        { id: "mod-cli", prefix: "mod", file: "static/modules.md", line: 3 },
        { id: "mod-core", prefix: "mod", file: "static/core.md", line: 3 },
      ],
      [
        { targetId: "mod-core", file: "static/modules.md", line: 5 },
      ]
    );
    const draftRefs = new Set(["mod-cli", "mod-core"]);
    const stateMap: StateMap = {};

    // Two groups WITH after: edge
    const groupGraph: GroupGraph = {
      groupElements: new Map([
        ["grp-group-a", new Set(["mod-cli"])],
        ["grp-group-b", new Set(["mod-core"])],
      ]),
      afterEdges: new Set(["grp-group-b->grp-group-a"]), // group-b after group-a
    };

    const result = verifyCoverage(["mod-cli"], draftRefs, graph, stateMap, groupGraph);

    expect(result.pass).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("does not attribute a sibling element's reference in the same file (per-element attribution)", () => {
    // modules.md declares mod-cli (line 3, in group A) and mod-other (line 7,
    // ungrouped). The reference at line 9 belongs to mod-other's section, not
    // mod-cli's. Without per-element attribution the warning would fire for
    // mod-cli (same class as the C11 misattribution bug fixed in R7).
    const graph = makeGraph(
      [
        { id: "mod-cli", prefix: "mod", file: "static/modules.md", line: 3 },
        { id: "mod-other", prefix: "mod", file: "static/modules.md", line: 7 },
        { id: "mod-core", prefix: "mod", file: "static/core.md", line: 3 },
      ],
      [
        { targetId: "mod-core", file: "static/modules.md", line: 9 },
      ]
    );
    const draftRefs = new Set(["mod-cli"]);
    const stateMap: StateMap = {};

    const groupGraph: GroupGraph = {
      groupElements: new Map([
        ["grp-group-a", new Set(["mod-cli"])],
        ["grp-group-b", new Set(["mod-core"])],
      ]),
      afterEdges: new Set(),
    };

    const result = verifyCoverage(["mod-cli"], draftRefs, graph, stateMap, groupGraph);

    // The cross-group reference belongs to mod-other, not mod-cli → no warning
    expect(result.pass).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("does not warn for references to elements not in any group", () => {
    // References to elements outside any group should not trigger cross-group warning
    const graph = makeGraph(
      [
        { id: "mod-cli", prefix: "mod", file: "static/modules.md", line: 3 },
        { id: "mod-core", prefix: "mod", file: "static/core.md", line: 3 },
      ],
      [
        { targetId: "mod-core", file: "static/modules.md", line: 5 },
      ]
    );
    const draftRefs = new Set(["mod-cli"]);
    const stateMap: StateMap = {};

    // Only grp-group-a exists; mod-core is NOT in any group
    const groupGraph: GroupGraph = {
      groupElements: new Map([
        ["grp-group-a", new Set(["mod-cli"])],
      ]),
      afterEdges: new Set(),
    };

    const result = verifyCoverage(["mod-cli"], draftRefs, graph, stateMap, groupGraph);

    // Should pass (mod-cli is covered) and no cross-group warning since mod-core is not in any group
    expect(result.pass).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// T-02g: Warnings do not affect pass
// ---------------------------------------------------------------------------

describe("verifyCoverage — warnings do not affect pass", () => {
  it("pass = true even when warnings exist (coverage is complete)", () => {
    const graph = makeGraph(
      [
        { id: "mod-cli", prefix: "mod", file: "static/modules.md", line: 3 },
        { id: "mod-core", prefix: "mod", file: "static/core.md", line: 3 },
      ],
      [
        { targetId: "mod-core", file: "static/modules.md", line: 5 },
      ]
    );
    // Both are cited
    const draftRefs = new Set(["mod-cli", "mod-core"]);
    const stateMap: StateMap = {};

    const groupGraph: GroupGraph = {
      groupElements: new Map([
        ["grp-group-a", new Set(["mod-cli"])],
        ["grp-group-b", new Set(["mod-core"])],
      ]),
      afterEdges: new Set(), // no after: edge → warning
    };

    // We verify grp-group-a coverage
    const result = verifyCoverage(["mod-cli"], draftRefs, graph, stateMap, groupGraph);

    expect(result.pass).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
