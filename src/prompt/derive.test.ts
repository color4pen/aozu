/**
 * Tests for src/prompt/derive.ts — buildDeriveInstruction.
 */

import { describe, it, expect } from "bun:test";
import { buildDeriveInstruction, type DeriveInput } from "./derive.ts";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<DeriveInput> = {}): DeriveInput {
  return {
    groupId: "grp-my-batch",
    groupElements: ["ent-order", "inv-order-valid"],
    elementBodies: new Map([
      ["ent-order", "注文エンティティの説明。[[inv-order-valid]] を満たす。"],
      ["inv-order-valid", "注文は必ず顧客 ID を持つ。"],
    ]),
    neighborBodies: new Map([
      ["mod-core", "責務: コアロジック\n実装: src/core/"],
    ]),
    termsAndInvariants: "## 注文 {#term-order}\n注文とは購入指示のことである。",
    templateContent: "# Request Template\n\nDescribe what to implement.\n\n## Elements\n<!-- list [[id]] references here -->",
    outputDir: "requests/",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Section 1: Template with delimiters
// ---------------------------------------------------------------------------

describe("buildDeriveInstruction — template section", () => {
  it("output contains ---TEMPLATE BEGIN--- delimiter", () => {
    const output = buildDeriveInstruction(makeInput());
    expect(output).toContain("---TEMPLATE BEGIN---");
  });

  it("output contains ---TEMPLATE END--- delimiter", () => {
    const output = buildDeriveInstruction(makeInput());
    expect(output).toContain("---TEMPLATE END---");
  });

  it("template content is between the delimiters", () => {
    const templateContent = "MY UNIQUE TEMPLATE CONTENT";
    const output = buildDeriveInstruction(makeInput({ templateContent }));
    const beginIdx = output.indexOf("---TEMPLATE BEGIN---");
    const endIdx = output.indexOf("---TEMPLATE END---");
    const between = output.slice(beginIdx, endIdx);
    expect(between).toContain(templateContent);
  });

  it("template content is not mixed into the instruction text outside delimiters", () => {
    const templateContent = "UNIQUE_MARKER_XYZ_TEMPLATE";
    const output = buildDeriveInstruction(makeInput({ templateContent }));
    const beginIdx = output.indexOf("---TEMPLATE BEGIN---");
    const endIdx = output.indexOf("---TEMPLATE END---") + "---TEMPLATE END---".length;
    const outside = output.slice(0, beginIdx) + output.slice(endIdx);
    expect(outside).not.toContain(templateContent);
  });
});

// ---------------------------------------------------------------------------
// Section 2: Target element bodies
// ---------------------------------------------------------------------------

describe("buildDeriveInstruction — target element bodies", () => {
  it("output contains body text of group elements", () => {
    const output = buildDeriveInstruction(makeInput());
    expect(output).toContain("注文エンティティの説明");
    expect(output).toContain("注文は必ず顧客 ID を持つ");
  });

  it("output contains element ID headers for group elements", () => {
    const output = buildDeriveInstruction(makeInput());
    expect(output).toContain("ent-order");
    expect(output).toContain("inv-order-valid");
  });

  it("shows placeholder when body is not available", () => {
    const input = makeInput({
      groupElements: ["ent-missing"],
      elementBodies: new Map(), // no body for ent-missing
    });
    const output = buildDeriveInstruction(input);
    expect(output).toContain("ent-missing");
    expect(output).toContain("body not available");
  });
});

// ---------------------------------------------------------------------------
// Section 3: Neighborhood element bodies
// ---------------------------------------------------------------------------

describe("buildDeriveInstruction — neighborhood element bodies", () => {
  it("output contains body text of neighborhood elements", () => {
    const output = buildDeriveInstruction(makeInput());
    expect(output).toContain("コアロジック");
    expect(output).toContain("src/core/");
  });

  it("output contains neighborhood element ID header", () => {
    const output = buildDeriveInstruction(makeInput());
    expect(output).toContain("mod-core");
  });

  it("shows placeholder when no neighborhood elements", () => {
    const output = buildDeriveInstruction(makeInput({ neighborBodies: new Map() }));
    expect(output).toContain("no neighborhood elements");
  });
});

// ---------------------------------------------------------------------------
// Section 4: Terms and invariants
// ---------------------------------------------------------------------------

describe("buildDeriveInstruction — terms and invariants", () => {
  it("output contains terms and invariants text", () => {
    const output = buildDeriveInstruction(makeInput());
    expect(output).toContain("注文とは購入指示のことである");
    expect(output).toContain("term-order");
  });

  it("shows placeholder when terms/invariants are empty", () => {
    const output = buildDeriveInstruction(makeInput({ termsAndInvariants: "" }));
    expect(output).toContain("no terms or invariants");
  });
});

// ---------------------------------------------------------------------------
// Section 5: Citation convention
// ---------------------------------------------------------------------------

describe("buildDeriveInstruction — citation convention", () => {
  it("output contains citation convention text in Japanese", () => {
    const output = buildDeriveInstruction(makeInput());
    expect(output).toContain("[[id]]");
    expect(output).toContain("引用は被覆の宣言");
  });

  it("output contains citation convention text in English", () => {
    const output = buildDeriveInstruction(makeInput());
    expect(output).toContain("coverage declarations");
  });
});

// ---------------------------------------------------------------------------
// Section 6: Output path
// ---------------------------------------------------------------------------

describe("buildDeriveInstruction — output path", () => {
  it("output contains the specified output directory path", () => {
    const output = buildDeriveInstruction(makeInput({ outputDir: "requests/my-feature/" }));
    expect(output).toContain("requests/my-feature/");
  });

  it("output path section is present", () => {
    const output = buildDeriveInstruction(makeInput());
    expect(output).toContain("## Output Path");
    expect(output).toContain("requests/");
  });
});

// ---------------------------------------------------------------------------
// All sections present
// ---------------------------------------------------------------------------

describe("buildDeriveInstruction — all 6 sections", () => {
  it("output contains all 6 required sections", () => {
    const output = buildDeriveInstruction(makeInput());
    // 1. Template
    expect(output).toContain("---TEMPLATE BEGIN---");
    expect(output).toContain("---TEMPLATE END---");
    // 2. Target element bodies
    expect(output).toContain("Target Element Bodies");
    // 3. Neighborhood
    expect(output).toContain("Neighborhood Element Bodies");
    // 4. Terms and invariants
    expect(output).toContain("Terms and Invariants");
    // 5. Citation convention
    expect(output).toContain("Citation Convention");
    // 6. Output path
    expect(output).toContain("Output Path");
  });
});
