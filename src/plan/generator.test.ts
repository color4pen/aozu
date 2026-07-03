/**
 * Tests for src/plan/generator.ts — generatePlan.
 */

import { describe, it, expect } from "bun:test";
import { generatePlan, type PlanAnnotations } from "./generator.ts";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeAnnotations(overrides: Partial<PlanAnnotations> = {}): PlanAnnotations {
  return {
    referenceEdges: [{ from: "ent-order", to: "inv-order-valid" }],
    modGrounding: new Map([["seq-my-flow", ["mod-core"]]]),
    requestedElements: [{ id: "ent-product", request: "product-feature" }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Frontmatter schema (spec §8)
// ---------------------------------------------------------------------------

describe("generatePlan — frontmatter schema", () => {
  it("includes id: plan-<slug> in frontmatter", () => {
    const output = generatePlan("my-batch", ["mod-cli"], makeAnnotations());
    expect(output).toContain("id: plan-my-batch");
  });

  it("includes status: open in frontmatter", () => {
    const output = generatePlan("my-batch", ["mod-cli"], makeAnnotations());
    expect(output).toContain("status: open");
  });

  it("frontmatter is delimited by --- lines", () => {
    const output = generatePlan("my-batch", ["mod-cli"], makeAnnotations());
    const lines = output.split("\n");
    expect(lines[0]).toBe("---");
    // find the second ---
    const secondDash = lines.indexOf("---", 1);
    expect(secondDash).toBeGreaterThan(1);
  });

  it("does NOT include a request: line (ADR-0018-2)", () => {
    const output = generatePlan("my-batch", ["mod-cli"], makeAnnotations());
    const lines = output.split("\n");
    const hasRequestLine = lines.some((l) => l.startsWith("request:") || l.startsWith("- request:"));
    expect(hasRequestLine).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// H1 heading (spec §5: display name is the first # heading)
// ---------------------------------------------------------------------------

describe("generatePlan — H1 heading", () => {
  it("has # <slug> as the H1 heading immediately after frontmatter", () => {
    const output = generatePlan("my-batch", ["mod-cli"], makeAnnotations());
    expect(output).toContain("# my-batch");
  });

  it("the H1 heading appears after the closing ---", () => {
    const output = generatePlan("my-batch", ["mod-cli"], makeAnnotations());
    const lines = output.split("\n");
    const closingDash = lines.indexOf("---", 1);
    // The H1 heading must appear somewhere after the closing ---
    const h1Idx = lines.indexOf("# my-batch");
    expect(h1Idx).toBeGreaterThan(closingDash);
  });
});

// ---------------------------------------------------------------------------
// Group structure
// ---------------------------------------------------------------------------

describe("generatePlan — group structure", () => {
  it("includes {#grp-<slug>} group heading", () => {
    const output = generatePlan("my-batch", ["mod-cli", "ent-order"], makeAnnotations());
    expect(output).toContain("{#grp-my-batch}");
  });

  it("includes all designed elements in the elements: line", () => {
    const output = generatePlan(
      "my-batch",
      ["mod-cli", "ent-order", "inv-order-valid"],
      makeAnnotations()
    );
    expect(output).toContain("[[mod-cli]]");
    expect(output).toContain("[[ent-order]]");
    expect(output).toContain("[[inv-order-valid]]");
  });

  it("includes - parallel: no line", () => {
    const output = generatePlan("my-batch", ["mod-cli"], makeAnnotations());
    expect(output).toContain("- parallel: no");
  });

  it("elements: line has all IDs as [[id]] references", () => {
    const output = generatePlan("my-batch", ["mod-a", "mod-b"], makeAnnotations());
    // The elements: line should have both IDs
    const elemLine = output.split("\n").find((l) => l.startsWith("- elements:"));
    expect(elemLine).toBeDefined();
    expect(elemLine).toContain("[[mod-a]]");
    expect(elemLine).toContain("[[mod-b]]");
  });
});

// ---------------------------------------------------------------------------
// Annotation section
// ---------------------------------------------------------------------------

describe("generatePlan — annotation section", () => {
  it("includes annotation section heading", () => {
    const output = generatePlan("my-batch", ["mod-cli"], makeAnnotations());
    expect(output).toContain("## 注釈");
  });

  it("includes reference edges in the annotation", () => {
    const annotations = makeAnnotations({
      referenceEdges: [
        { from: "ent-order", to: "inv-order-valid" },
        { from: "ent-order", to: "term-status" },
      ],
    });
    const output = generatePlan("my-batch", ["mod-cli"], annotations);
    expect(output).toContain("[[ent-order]]");
    expect(output).toContain("[[inv-order-valid]]");
    expect(output).toContain("[[term-status]]");
  });

  it("includes mod grounding in the annotation", () => {
    const annotations = makeAnnotations({
      modGrounding: new Map([["seq-my-flow", ["mod-core", "mod-cli"]]]),
    });
    const output = generatePlan("my-batch", ["mod-cli"], annotations);
    expect(output).toContain("[[seq-my-flow]]");
    expect(output).toContain("[[mod-core]]");
  });

  it("includes requested elements in the annotation", () => {
    const annotations = makeAnnotations({
      requestedElements: [
        { id: "ent-product", request: "product-feature" },
        { id: "mod-search", request: "search-impl" },
      ],
    });
    const output = generatePlan("my-batch", ["mod-cli"], annotations);
    expect(output).toContain("[[ent-product]]");
    expect(output).toContain("product-feature");
    expect(output).toContain("[[mod-search]]");
    expect(output).toContain("search-impl");
  });

  it("shows placeholder when reference edges are empty", () => {
    const annotations = makeAnnotations({ referenceEdges: [] });
    const output = generatePlan("my-batch", ["mod-cli"], annotations);
    expect(output).toContain("設計済み要素間の参照なし");
  });

  it("shows placeholder when requested elements are empty", () => {
    const annotations = makeAnnotations({ requestedElements: [] });
    const output = generatePlan("my-batch", ["mod-cli"], annotations);
    expect(output).toContain("実行中の要素なし");
  });
});
