/**
 * Tests for op-element implementation: TC-021 through TC-024
 *
 * Covers:
 *   TC Group 10 (should): TargetLine and MalformedPermOperation parsing
 *
 * These tests access the new output fields on StructuredLineResult
 * (targetLines, malformedPermOperations) that will be added by the
 * implementation. Pre-implementation: those fields are undefined at
 * runtime → assertions fail → RED.
 */

import { describe, expect, it } from "bun:test";
import { extractStructuredLines } from "./structured-lines.ts";

// ---------------------------------------------------------------------------
// TC Group 10: TargetLine — 対象: line parsing
// ---------------------------------------------------------------------------

describe("TC-021: TargetLine stores single reference as one-element targetIds array", () => {
  it("TC-021: 対象: [[ent-order]] → targetLines[0].targetIds = ['ent-order']", () => {
    // After implementation: extractStructuredLines returns targetLines instead of permTargets.
    // TargetLine has targetIds: string[] — single reference → one-element array.
    // Pre-implementation: result.targetLines is undefined → TypeError → RED.
    const result = extractStructuredLines("対象: [[ent-order]]", "test.md");

    // Access the new field (post-implementation only)
    const targetLines = (result as Record<string, unknown>)["targetLines"] as
      | Array<{ targetIds: string[]; file: string; line: number }>
      | undefined;

    expect(targetLines).toBeDefined();
    expect(targetLines).toHaveLength(1);
    expect(targetLines![0]!.targetIds).toEqual(["ent-order"]);
    expect(targetLines![0]!.line).toBe(1);
    expect(targetLines![0]!.file).toBe("test.md");
  });
});

describe("TC-022: TargetLine stores multiple references as multi-element targetIds array", () => {
  it("TC-022: 対象: [[ent-order]], [[ent-customer]] → targetIds = ['ent-order', 'ent-customer']", () => {
    // After implementation: comma-separated [[id]] values → targetIds array in order.
    // Pre-implementation: result.targetLines is undefined → RED.
    const result = extractStructuredLines(
      "対象: [[ent-order]], [[ent-customer]]",
      "test.md"
    );

    const targetLines = (result as Record<string, unknown>)["targetLines"] as
      | Array<{ targetIds: string[]; file: string; line: number }>
      | undefined;

    expect(targetLines).toBeDefined();
    expect(targetLines).toHaveLength(1);
    expect(targetLines![0]!.targetIds).toEqual(["ent-order", "ent-customer"]);
  });
});

// ---------------------------------------------------------------------------
// TC Group 10: Operation line parsing (new RE vs free-token)
// ---------------------------------------------------------------------------

describe("TC-023: valid [[op-id]] operation line stored with op ID as operation field", () => {
  it("TC-023: - [[op-create-deal]]: [[act-admin]] → permOperations with operation='op-create-deal'", () => {
    // After implementation: new PERM_OPERATION_LINE_RE captures id without brackets.
    // operation field = "op-create-deal" (no brackets).
    // Pre-implementation: old RE captures "[[op-create-deal]]" (brackets included) → RED.
    const content = "- [[op-create-deal]]: [[act-admin]]";
    const result = extractStructuredLines(content, "views/permission/deal.md");

    expect(result.permOperations).toHaveLength(1);
    expect(result.permOperations[0]!.operation).toBe("op-create-deal");
    expect(result.permOperations[0]!.actorIds).toEqual(["act-admin"]);
    expect(result.permOperations[0]!.file).toBe("views/permission/deal.md");
    expect(result.permOperations[0]!.line).toBe(1);

    // Also verify it is NOT in malformedPermOperations
    const malformed = (result as Record<string, unknown>)[
      "malformedPermOperations"
    ] as Array<unknown> | undefined;
    expect(malformed ?? []).toHaveLength(0);
  });
});

describe("TC-024: free-token operation line stored as MalformedPermOperation, not in permOperations", () => {
  it("TC-024: - create: [[act-admin]] → malformedPermOperations, not permOperations", () => {
    // After implementation: free token doesn't match new RE but matches legacy RE →
    // goes to malformedPermOperations, NOT permOperations.
    // Pre-implementation: old RE matches → goes to permOperations → this test fails → RED.
    const content = "- create: [[act-admin]]";
    const result = extractStructuredLines(content, "views/permission/deal.md");

    // permOperations must be empty (no valid op-reference operation lines)
    expect(result.permOperations).toHaveLength(0);

    // malformedPermOperations must have the line
    const malformed = (result as Record<string, unknown>)[
      "malformedPermOperations"
    ] as
      | Array<{ file: string; line: number; text: string }>
      | undefined;

    expect(malformed).toBeDefined();
    expect(malformed).toHaveLength(1);
    expect(malformed![0]!.file).toBe("views/permission/deal.md");
    expect(malformed![0]!.line).toBe(1);
  });
});
