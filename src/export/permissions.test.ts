/**
 * Unit tests for generatePermissions (mod-export permissions).
 */

import { describe, expect, it } from "bun:test";
import { generatePermissions } from "./permissions.ts";
import { buildGraph } from "../graph/builder.ts";
import type { ParseResult } from "../parse/types.ts";

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
    permTargets: [],
    ...overrides,
  };
  return buildGraph(parsed);
}

describe("generatePermissions: basic output", () => {
  it("empty graph produces empty permissions array", () => {
    const graph = makeGraph();
    const { json } = generatePermissions(graph);
    const output = JSON.parse(json);
    expect(output["format-version"]).toBe(0);
    expect(output.permissions).toEqual([]);
  });

  it("single perm element with one operation", () => {
    const graph = makeGraph({
      elements: [
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
        { id: "act-admin", prefix: "act", displayName: "Admin", file: "domain/actors.md", line: 1 },
      ],
      permOperations: [
        { operation: "create", actorIds: ["act-admin"], file: "views/permission/deal.md", line: 3 },
      ],
    });
    const { json } = generatePermissions(graph);
    const output = JSON.parse(json);
    expect(output.permissions).toHaveLength(1);
    expect(output.permissions[0].id).toBe("perm-deal");
    expect(output.permissions[0].operations).toEqual({ create: ["act-admin"] });
    // No target field when no 対象: line
    expect(output.permissions[0].target).toBeUndefined();
  });

  it("perm element with 対象: line → target field included", () => {
    const graph = makeGraph({
      elements: [
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
        { id: "ent-deal", prefix: "ent", displayName: "Deal Entity", file: "domain/model.md", line: 1 },
      ],
      permOperations: [
        { operation: "list", actorIds: ["act-admin"], file: "views/permission/deal.md", line: 4 },
      ],
      permTargets: [
        { targetId: "ent-deal", file: "views/permission/deal.md", line: 2 },
      ],
    });
    const { json } = generatePermissions(graph);
    const output = JSON.parse(json);
    expect(output.permissions[0].target).toBe("ent-deal");
  });

  it("perm element without 対象: line → target field absent", () => {
    const graph = makeGraph({
      elements: [
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
      ],
      permOperations: [
        { operation: "create", actorIds: ["act-admin"], file: "views/permission/deal.md", line: 3 },
      ],
    });
    const { json } = generatePermissions(graph);
    const output = JSON.parse(json);
    expect("target" in output.permissions[0]).toBe(false);
  });
});

describe("generatePermissions: deterministic ordering", () => {
  it("permissions sorted by id ascending", () => {
    const graph = makeGraph({
      elements: [
        { id: "perm-zzz", prefix: "perm", displayName: "ZZZ", file: "views/permission/zzz.md", line: 1 },
        { id: "perm-aaa", prefix: "perm", displayName: "AAA", file: "views/permission/aaa.md", line: 1 },
        { id: "perm-mmm", prefix: "perm", displayName: "MMM", file: "views/permission/mmm.md", line: 1 },
      ],
      permOperations: [
        { operation: "read", actorIds: ["act-admin"], file: "views/permission/zzz.md", line: 3 },
        { operation: "read", actorIds: ["act-admin"], file: "views/permission/aaa.md", line: 3 },
        { operation: "read", actorIds: ["act-admin"], file: "views/permission/mmm.md", line: 3 },
      ],
    });
    const { json } = generatePermissions(graph);
    const output = JSON.parse(json);
    const ids = output.permissions.map((p: { id: string }) => p.id);
    expect(ids).toEqual(["perm-aaa", "perm-mmm", "perm-zzz"]);
  });

  it("operations keys in lexicographic order", () => {
    const graph = makeGraph({
      elements: [
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
      ],
      permOperations: [
        { operation: "update", actorIds: ["act-admin"], file: "views/permission/deal.md", line: 5 },
        { operation: "create", actorIds: ["act-admin"], file: "views/permission/deal.md", line: 3 },
        { operation: "list", actorIds: ["act-admin"], file: "views/permission/deal.md", line: 4 },
        { operation: "delete", actorIds: ["act-admin"], file: "views/permission/deal.md", line: 6 },
      ],
    });
    const { json } = generatePermissions(graph);
    const output = JSON.parse(json);
    const keys = Object.keys(output.permissions[0].operations);
    expect(keys).toEqual(["create", "delete", "list", "update"]);
  });

  it("act arrays in ID ascending order", () => {
    const graph = makeGraph({
      elements: [
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
      ],
      permOperations: [
        {
          operation: "list",
          actorIds: ["act-member", "act-admin", "act-finance", "act-manager"],
          file: "views/permission/deal.md",
          line: 3,
        },
      ],
    });
    const { json } = generatePermissions(graph);
    const output = JSON.parse(json);
    expect(output.permissions[0].operations.list).toEqual(["act-admin", "act-finance", "act-manager", "act-member"]);
  });

  it("spec §8 example: perm-deal with list and create", () => {
    const graph = makeGraph({
      elements: [
        { id: "perm-deal", prefix: "perm", displayName: "Deal Permissions", file: "views/permission/deal.md", line: 1 },
        { id: "ent-deal", prefix: "ent", displayName: "Deal", file: "domain/model.md", line: 1 },
        { id: "act-admin", prefix: "act", displayName: "Admin", file: "domain/actors.md", line: 1 },
        { id: "act-manager", prefix: "act", displayName: "Manager", file: "domain/actors.md", line: 5 },
        { id: "act-member", prefix: "act", displayName: "Member", file: "domain/actors.md", line: 9 },
        { id: "act-finance", prefix: "act", displayName: "Finance", file: "domain/actors.md", line: 13 },
      ],
      permOperations: [
        {
          operation: "list",
          actorIds: ["act-admin", "act-manager", "act-member", "act-finance"],
          file: "views/permission/deal.md",
          line: 4,
        },
        {
          operation: "create",
          actorIds: ["act-admin", "act-manager"],
          file: "views/permission/deal.md",
          line: 5,
        },
      ],
      permTargets: [
        { targetId: "ent-deal", file: "views/permission/deal.md", line: 2 },
      ],
    });
    const { json } = generatePermissions(graph);
    const output = JSON.parse(json);

    expect(output["format-version"]).toBe(0);
    expect(output.permissions).toHaveLength(1);

    const perm = output.permissions[0];
    expect(perm.id).toBe("perm-deal");
    expect(perm.target).toBe("ent-deal");
    expect(Object.keys(perm.operations)).toEqual(["create", "list"]);
    expect(perm.operations.create).toEqual(["act-admin", "act-manager"]);
    expect(perm.operations.list).toEqual(["act-admin", "act-finance", "act-manager", "act-member"]);
  });
});

describe("generatePermissions: JSON format", () => {
  it("output ends with newline", () => {
    const graph = makeGraph();
    const { json } = generatePermissions(graph);
    expect(json.endsWith("\n")).toBe(true);
  });

  it("output is valid JSON", () => {
    const graph = makeGraph({
      elements: [
        { id: "perm-deal", prefix: "perm", displayName: "Deal", file: "views/permission/deal.md", line: 1 },
      ],
      permOperations: [
        { operation: "create", actorIds: ["act-admin"], file: "views/permission/deal.md", line: 3 },
      ],
    });
    const { json } = generatePermissions(graph);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
