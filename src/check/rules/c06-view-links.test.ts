import { describe, expect, it } from "bun:test";
import { checkC6 } from "./c06-view-links.ts";
import type { Manifest } from "../../graph/types.ts";
import { buildGraph } from "../../graph/builder.ts";
import type { ParseResult } from "../../parse/types.ts";

const manifest = (enabled: string[]): Manifest => ({ formatVersion: "0", enabled });

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
    permOperations: [],
    targetLines: [],
    malformedPermOperations: [],
    ...overrides,
  };
  return buildGraph(parsed);
}

describe("checkC6: view type fail-closed", () => {
  it("no view types in enabled → no diagnostics", () => {
    expect(checkC6(manifest(["static", "domain", "dynamic"]), makeGraph())).toHaveLength(0);
  });

  it("'use-case' in enabled → C6 diagnostic", () => {
    const diags = checkC6(manifest(["static", "domain", "use-case"]), makeGraph());
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C6");
    expect(diags[0]!.level).toBe("error");
    expect(diags[0]!.message).toContain("unsupported view type");
    expect(diags[0]!.message).toContain("use-case");
  });

  it("multiple view types → one C6 per unsupported view type", () => {
    const diags = checkC6(manifest(["static", "use-case", "screen"]), makeGraph());
    expect(diags).toHaveLength(2);
    const codes = diags.map((d) => d.code);
    expect(codes).toEqual(["C6", "C6"]);
    const messages = diags.map((d) => d.message);
    expect(messages.some((m) => m.includes("use-case"))).toBe(true);
    expect(messages.some((m) => m.includes("screen"))).toBe(true);
  });

  it("all unsupported view types trigger C6 (permission excluded — it is supported)", () => {
    // permission is a supported view type and should NOT produce a C6 unsupported error
    const unsupportedViewTypes = ["use-case", "screen", "api", "data", "dataflow", "event", "external", "deployment"];
    for (const vt of unsupportedViewTypes) {
      const diags = checkC6(manifest([vt]), makeGraph());
      expect(diags).toHaveLength(1);
      expect(diags[0]!.code).toBe("C6");
      expect(diags[0]!.message).toContain("unsupported view type");
    }
  });

  it("empty enabled → no diagnostics", () => {
    expect(checkC6(manifest([]), makeGraph())).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// C6 perm validation tests (T-11)
// ---------------------------------------------------------------------------

describe("checkC6: perm validation when permission enabled", () => {
  it("permission enabled + no perm elements → C6 pass (empty view is legal)", () => {
    const graph = makeGraph({
      elements: [
        { id: "mod-workflow", prefix: "mod", displayName: "Workflow", file: "modules.md", line: 1 },
      ],
    });
    const diags = checkC6(manifest(["static", "domain", "permission"]), graph);
    expect(diags).toHaveLength(0);
  });

  it("permission enabled + valid perm element (operation with op + act prefix) → C6 pass", () => {
    const graph = makeGraph({
      elements: [
        { id: "perm-deal", prefix: "perm", displayName: "Deal Permissions", file: "views/permission/deal.md", line: 1 },
        { id: "op-create-deal", prefix: "op", displayName: "Create Deal", file: "domain/operations.md", line: 1 },
        { id: "op-list-deals", prefix: "op", displayName: "List Deals", file: "domain/operations.md", line: 5 },
        { id: "act-admin", prefix: "act", displayName: "Admin", file: "domain/actors.md", line: 1 },
      ],
      permOperations: [
        { operation: "op-create-deal", actorIds: ["act-admin"], file: "views/permission/deal.md", line: 3 },
        { operation: "op-list-deals", actorIds: ["act-admin"], file: "views/permission/deal.md", line: 4 },
      ],
    });
    const diags = checkC6(manifest(["static", "domain", "permission"]), graph);
    expect(diags).toHaveLength(0);
  });

  it("permission enabled + zero operation lines → C6 error (non-empty obligation)", () => {
    const graph = makeGraph({
      elements: [
        { id: "perm-empty", prefix: "perm", displayName: "Empty", file: "views/permission/empty.md", line: 1 },
      ],
      permOperations: [],
    });
    const diags = checkC6(manifest(["static", "domain", "permission"]), graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C6");
    expect(diags[0]!.level).toBe("error");
    expect(diags[0]!.message).toContain("perm-empty");
    expect(diags[0]!.message).toContain("no operation lines");
  });

  it("permission enabled + duplicate operation in same perm → C6 error", () => {
    const graph = makeGraph({
      elements: [
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
        { id: "op-create-deal", prefix: "op", displayName: "Create Deal", file: "domain/operations.md", line: 1 },
      ],
      permOperations: [
        { operation: "op-create-deal", actorIds: ["act-admin"], file: "views/permission/deal.md", line: 3 },
        { operation: "op-create-deal", actorIds: ["act-manager"], file: "views/permission/deal.md", line: 4 },
      ],
    });
    const diags = checkC6(manifest(["static", "domain", "permission"]), graph);
    expect(diags.some((d) => d.code === "C6" && d.message.includes("duplicate operation"))).toBe(true);
    expect(diags.some((d) => d.message.includes("op-create-deal"))).toBe(true);
  });

  it("permission enabled + non-act prefix reference → C6 error", () => {
    const graph = makeGraph({
      elements: [
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
        { id: "op-create-deal", prefix: "op", displayName: "Create Deal", file: "domain/operations.md", line: 1 },
      ],
      permOperations: [
        { operation: "op-create-deal", actorIds: ["ent-order"], file: "views/permission/deal.md", line: 3 },
      ],
    });
    const diags = checkC6(manifest(["static", "domain", "permission"]), graph);
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C6");
    expect(diags[0]!.message).toContain("ent-order");
    expect(diags[0]!.message).toContain("not an act element");
  });

  it("permission enabled + unresolved act reference → no C6 error (C3 handles resolution)", () => {
    const graph = makeGraph({
      elements: [
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
        { id: "op-create-deal", prefix: "op", displayName: "Create Deal", file: "domain/operations.md", line: 1 },
        // act-nonexistent is NOT declared — C6 should not check resolution
      ],
      permOperations: [
        { operation: "op-create-deal", actorIds: ["act-nonexistent"], file: "views/permission/deal.md", line: 3 },
      ],
    });
    const diags = checkC6(manifest(["static", "domain", "permission"]), graph);
    // C6 should pass (prefix is "act" — that's all C6 checks for actors)
    expect(diags).toHaveLength(0);
  });

  it("permission + screen enabled → permission validates perm, screen produces unsupported error", () => {
    const graph = makeGraph({
      elements: [
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
        { id: "op-create-deal", prefix: "op", displayName: "Create Deal", file: "domain/operations.md", line: 1 },
        { id: "act-admin", prefix: "act", displayName: "Admin", file: "domain/actors.md", line: 1 },
      ],
      permOperations: [
        { operation: "op-create-deal", actorIds: ["act-admin"], file: "views/permission/deal.md", line: 3 },
      ],
    });
    const diags = checkC6(manifest(["static", "domain", "permission", "screen"]), graph);
    // permission: valid perm → no C6 error for permission
    // screen: unsupported → C6 error
    const c6errors = diags.filter((d) => d.code === "C6");
    expect(c6errors).toHaveLength(1);
    expect(c6errors[0]!.message).toContain("screen");
    expect(c6errors[0]!.message).toContain("unsupported view type");
  });
});
