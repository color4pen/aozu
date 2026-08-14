/**
 * Unit tests for generateOperations (mod-export operations).
 *
 * TC-001: op with target and implementation produces correct JSON
 * TC-002: op without target or implementation outputs id and name only
 * TC-003: target present but implementation absent omits implementation key
 * TC-004: implementation present but target absent omits target key
 * TC-005: multiple ops sorted by id ascending regardless of declaration order
 * TC-006: repeated runs on same input produce byte-identical output
 * TC-007: multiple targets in 対象: line preserved in declaration order
 * TC-008: multiple 実装: lines merged in line-number order
 * TC-015: generateOperations is a pure function with no file I/O
 * TC-016: JSON output ends with a trailing newline
 * TC-017: JSON output is syntactically valid JSON
 * TC-018: empty graph at unit level returns operations: []
 * TC-020: multiple paths within a single 実装: line are preserved in declaration order
 */

import { describe, expect, it } from "bun:test";
import { generateOperations } from "./operations.ts";
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
    targetLines: [],
    malformedPermOperations: [],
    ...overrides,
  };
  return buildGraph(parsed);
}

// ---------------------------------------------------------------------------
// TC-001: op with target and implementation produces correct JSON
// ---------------------------------------------------------------------------

describe("TC-001: op with target and implementation produces correct JSON", () => {
  it("TC-001: id, name, target array, implementation array all present", () => {
    const graph = makeGraph({
      elements: [
        {
          id: "op-confirm-order",
          prefix: "op",
          displayName: "受注を確定する",
          file: "domain/operations.md",
          line: 1,
        },
      ],
      targetLines: [
        { targetIds: ["ent-order"], file: "domain/operations.md", line: 2 },
      ],
      implementations: [
        {
          paths: ["src/application/confirm-order.ts"],
          file: "domain/operations.md",
          line: 3,
        },
      ],
    });

    const { json } = generateOperations(graph);
    const output = JSON.parse(json);

    expect(output["format-version"]).toBe(0);
    expect(output.operations).toHaveLength(1);

    const op = output.operations[0];
    expect(op.id).toBe("op-confirm-order");
    expect(op.name).toBe("受注を確定する");
    expect(op.target).toEqual(["ent-order"]);
    expect(op.implementation).toEqual(["src/application/confirm-order.ts"]);
  });
});

// ---------------------------------------------------------------------------
// TC-002: op without target or implementation outputs id and name only
// ---------------------------------------------------------------------------

describe("TC-002: op without target or implementation outputs id and name only", () => {
  it("TC-002: only id and name fields present when no 対象: or 実装: lines", () => {
    const graph = makeGraph({
      elements: [
        {
          id: "op-placeholder",
          prefix: "op",
          displayName: "仮操作",
          file: "domain/operations.md",
          line: 1,
        },
      ],
    });

    const { json } = generateOperations(graph);
    const output = JSON.parse(json);

    expect(output.operations).toHaveLength(1);
    const op = output.operations[0];
    expect(op.id).toBe("op-placeholder");
    expect(op.name).toBe("仮操作");
    expect("target" in op).toBe(false);
    expect("implementation" in op).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TC-003: target present but implementation absent omits implementation key
// ---------------------------------------------------------------------------

describe("TC-003: target present but implementation absent omits implementation key", () => {
  it("TC-003: target key present, implementation key absent", () => {
    const graph = makeGraph({
      elements: [
        {
          id: "op-foo",
          prefix: "op",
          displayName: "フー",
          file: "domain/operations.md",
          line: 1,
        },
      ],
      targetLines: [
        { targetIds: ["ent-order"], file: "domain/operations.md", line: 2 },
      ],
    });

    const { json } = generateOperations(graph);
    const output = JSON.parse(json);

    const op = output.operations[0];
    expect(op.target).toEqual(["ent-order"]);
    expect("implementation" in op).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TC-004: implementation present but target absent omits target key
// ---------------------------------------------------------------------------

describe("TC-004: implementation present but target absent omits target key", () => {
  it("TC-004: implementation key present, target key absent", () => {
    const graph = makeGraph({
      elements: [
        {
          id: "op-foo",
          prefix: "op",
          displayName: "フー",
          file: "domain/operations.md",
          line: 1,
        },
      ],
      implementations: [
        {
          paths: ["src/app/foo.ts"],
          file: "domain/operations.md",
          line: 2,
        },
      ],
    });

    const { json } = generateOperations(graph);
    const output = JSON.parse(json);

    const op = output.operations[0];
    expect(op.implementation).toEqual(["src/app/foo.ts"]);
    expect("target" in op).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TC-005: multiple ops sorted by id ascending regardless of declaration order
// ---------------------------------------------------------------------------

describe("TC-005: multiple ops sorted by id ascending regardless of declaration order", () => {
  it("TC-005: op-zzz, op-aaa, op-mmm declared in that order → output is op-aaa, op-mmm, op-zzz", () => {
    const graph = makeGraph({
      elements: [
        {
          id: "op-zzz",
          prefix: "op",
          displayName: "ZZZ",
          file: "domain/operations.md",
          line: 1,
        },
        {
          id: "op-aaa",
          prefix: "op",
          displayName: "AAA",
          file: "domain/operations.md",
          line: 5,
        },
        {
          id: "op-mmm",
          prefix: "op",
          displayName: "MMM",
          file: "domain/operations.md",
          line: 9,
        },
      ],
    });

    const { json } = generateOperations(graph);
    const output = JSON.parse(json);

    const ids = output.operations.map((op: { id: string }) => op.id);
    expect(ids).toEqual(["op-aaa", "op-mmm", "op-zzz"]);
  });
});

// ---------------------------------------------------------------------------
// TC-006: repeated runs on same input produce byte-identical output
// ---------------------------------------------------------------------------

describe("TC-006: repeated runs on same input produce byte-identical output", () => {
  it("TC-006: two calls with the same graph return identical json strings", () => {
    const graph = makeGraph({
      elements: [
        {
          id: "op-confirm-order",
          prefix: "op",
          displayName: "受注を確定する",
          file: "domain/operations.md",
          line: 1,
        },
        {
          id: "op-cancel-order",
          prefix: "op",
          displayName: "受注をキャンセルする",
          file: "domain/operations.md",
          line: 5,
        },
      ],
      targetLines: [
        { targetIds: ["ent-order"], file: "domain/operations.md", line: 2 },
        { targetIds: ["ent-order", "ent-customer"], file: "domain/operations.md", line: 6 },
      ],
      implementations: [
        {
          paths: ["src/application/confirm-order.ts"],
          file: "domain/operations.md",
          line: 3,
        },
      ],
    });

    const { json: json1 } = generateOperations(graph);
    const { json: json2 } = generateOperations(graph);
    expect(json1).toBe(json2);
  });
});

// ---------------------------------------------------------------------------
// TC-007: multiple targets in 対象: line preserved in declaration order
// ---------------------------------------------------------------------------

describe("TC-007: multiple targets in 対象: line preserved in declaration order", () => {
  it("TC-007: 対象: [[ent-order]], [[ent-customer]] → target: ['ent-order', 'ent-customer']", () => {
    const graph = makeGraph({
      elements: [
        {
          id: "op-foo",
          prefix: "op",
          displayName: "フー",
          file: "domain/operations.md",
          line: 1,
        },
      ],
      targetLines: [
        {
          targetIds: ["ent-order", "ent-customer"],
          file: "domain/operations.md",
          line: 2,
        },
      ],
    });

    const { json } = generateOperations(graph);
    const output = JSON.parse(json);

    // Declaration order preserved: ent-order before ent-customer (not sorted)
    expect(output.operations[0].target).toEqual(["ent-order", "ent-customer"]);
  });
});

// ---------------------------------------------------------------------------
// TC-008: multiple 実装: lines merged in line-number order
// ---------------------------------------------------------------------------

describe("TC-008: multiple 実装: lines merged in line-number order", () => {
  it("TC-008: 実装: src/a.ts at line 5 and 実装: src/b.ts at line 8 → implementation: ['src/a.ts', 'src/b.ts']", () => {
    const graph = makeGraph({
      elements: [
        {
          id: "op-foo",
          prefix: "op",
          displayName: "フー",
          file: "domain/operations.md",
          line: 1,
        },
      ],
      implementations: [
        { paths: ["src/a.ts"], file: "domain/operations.md", line: 5 },
        { paths: ["src/b.ts"], file: "domain/operations.md", line: 8 },
      ],
    });

    const { json } = generateOperations(graph);
    const output = JSON.parse(json);

    expect(output.operations[0].implementation).toEqual(["src/a.ts", "src/b.ts"]);
  });
});

// ---------------------------------------------------------------------------
// TC-015: generateOperations is a pure function with no file I/O
// ---------------------------------------------------------------------------

describe("TC-015: generateOperations is a pure function with no file I/O", () => {
  it("TC-015: calling twice with the same graph returns structurally identical output", () => {
    const graph = makeGraph({
      elements: [
        {
          id: "op-confirm-order",
          prefix: "op",
          displayName: "受注を確定する",
          file: "domain/operations.md",
          line: 1,
        },
      ],
      targetLines: [
        { targetIds: ["ent-order"], file: "domain/operations.md", line: 2 },
      ],
      implementations: [
        {
          paths: ["src/application/confirm-order.ts"],
          file: "domain/operations.md",
          line: 3,
        },
      ],
    });

    const result1 = generateOperations(graph);
    const result2 = generateOperations(graph);

    // Structurally identical (pure function, no side effects)
    expect(result1.json).toBe(result2.json);
    // Returns { json: string } shape
    expect(typeof result1.json).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// TC-016: JSON output ends with a trailing newline
// ---------------------------------------------------------------------------

describe("TC-016: JSON output ends with a trailing newline", () => {
  it("TC-016: returned json string ends with '\\n' for empty graph", () => {
    const graph = makeGraph();
    const { json } = generateOperations(graph);
    expect(json.endsWith("\n")).toBe(true);
  });

  it("TC-016: returned json string ends with '\\n' for non-empty graph", () => {
    const graph = makeGraph({
      elements: [
        {
          id: "op-foo",
          prefix: "op",
          displayName: "フー",
          file: "domain/operations.md",
          line: 1,
        },
      ],
    });
    const { json } = generateOperations(graph);
    expect(json.endsWith("\n")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-017: JSON output is syntactically valid JSON
// ---------------------------------------------------------------------------

describe("TC-017: JSON output is syntactically valid JSON", () => {
  it("TC-017: JSON.parse does not throw; result has format-version: 0 and operations array", () => {
    const graph = makeGraph({
      elements: [
        {
          id: "op-foo",
          prefix: "op",
          displayName: "フー",
          file: "domain/operations.md",
          line: 1,
        },
      ],
    });
    const { json } = generateOperations(graph);
    let parsed: unknown;
    expect(() => { parsed = JSON.parse(json); }).not.toThrow();
    expect((parsed as Record<string, unknown>)["format-version"]).toBe(0);
    expect(Array.isArray((parsed as Record<string, unknown>).operations)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-018: empty graph at unit level returns operations: []
// ---------------------------------------------------------------------------

describe("TC-018: empty graph at unit level returns operations: []", () => {
  it("TC-018: empty graph → { 'format-version': 0, 'operations': [] }", () => {
    const graph = makeGraph();
    const { json } = generateOperations(graph);
    const output = JSON.parse(json);
    expect(output["format-version"]).toBe(0);
    expect(output.operations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// TC-020: multiple paths within a single 実装: line are preserved in declaration order
// ---------------------------------------------------------------------------

describe("TC-020: multiple paths within a single 実装: line preserved in declaration order", () => {
  it("TC-020: single 実装: line with src/a.ts, src/b.ts → implementation: ['src/a.ts', 'src/b.ts']", () => {
    const graph = makeGraph({
      elements: [
        {
          id: "op-foo",
          prefix: "op",
          displayName: "フー",
          file: "domain/operations.md",
          line: 1,
        },
      ],
      implementations: [
        {
          paths: ["src/a.ts", "src/b.ts"],
          file: "domain/operations.md",
          line: 3,
        },
      ],
    });

    const { json } = generateOperations(graph);
    const output = JSON.parse(json);

    // Declaration order preserved: src/a.ts before src/b.ts (not sorted alphabetically)
    expect(output.operations[0].implementation).toEqual(["src/a.ts", "src/b.ts"]);
  });
});
