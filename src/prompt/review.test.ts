/**
 * Tests for src/prompt/review.ts — buildReviewInstruction.
 */

import { describe, it, expect } from "bun:test";
import {
  buildReviewInstruction,
  REVIEW_GUIDANCE,
  type ReviewInput,
} from "./review.ts";
import { FORMAT_RULES_SUMMARY } from "./shared.ts";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<ReviewInput> = {}): ReviewInput {
  return {
    allBodies: new Map([
      ["ent-order", "注文エンティティの説明。"],
      ["inv-order-valid", "注文は必ず顧客 ID を持つ。"],
      ["mod-core", "責務: コアロジック"],
      ["term-status", "注文の状態を表す。"],
    ]),
    formatRulesSummary: FORMAT_RULES_SUMMARY,
    reviewGuidance: REVIEW_GUIDANCE,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// All 3 sections present
// ---------------------------------------------------------------------------

describe("buildReviewInstruction — all 3 sections", () => {
  it("output contains all 3 required section headers", () => {
    const output = buildReviewInstruction(makeInput());
    // 1. All Element Bodies
    expect(output).toContain("## All Element Bodies");
    // 2. Format Rules
    expect(output).toContain("## Format Rules");
    // 3. Review Guidance
    expect(output).toContain("## Review Guidance");
  });
});

// ---------------------------------------------------------------------------
// Section 1: All Element Bodies
// ---------------------------------------------------------------------------

describe("buildReviewInstruction — all element bodies section", () => {
  it("output contains all element IDs as subsection headers", () => {
    const output = buildReviewInstruction(makeInput());
    expect(output).toContain("### ent-order");
    expect(output).toContain("### inv-order-valid");
    expect(output).toContain("### mod-core");
    expect(output).toContain("### term-status");
  });

  it("output contains all element body texts", () => {
    const output = buildReviewInstruction(makeInput());
    expect(output).toContain("注文エンティティの説明");
    expect(output).toContain("顧客 ID");
    expect(output).toContain("コアロジック");
    expect(output).toContain("注文の状態を表す");
  });

  it("elements appear in ID lexicographic order (caller's responsibility, Map order respected)", () => {
    // The Map is pre-sorted by the caller; the function must iterate in insertion order
    const sortedMap = new Map([
      ["ent-order", "body-ent"],
      ["inv-order-valid", "body-inv"],
      ["mod-core", "body-mod"],
      ["term-status", "body-term"],
    ]);
    const output = buildReviewInstruction(makeInput({ allBodies: sortedMap }));

    // Verify order by checking index positions
    const entIdx = output.indexOf("### ent-order");
    const invIdx = output.indexOf("### inv-order-valid");
    const modIdx = output.indexOf("### mod-core");
    const termIdx = output.indexOf("### term-status");

    expect(entIdx).toBeGreaterThanOrEqual(0);
    expect(invIdx).toBeGreaterThanOrEqual(0);
    expect(modIdx).toBeGreaterThanOrEqual(0);
    expect(termIdx).toBeGreaterThanOrEqual(0);

    expect(entIdx).toBeLessThan(invIdx);
    expect(invIdx).toBeLessThan(modIdx);
    expect(modIdx).toBeLessThan(termIdx);
  });

  it("shows placeholder when allBodies is empty", () => {
    const output = buildReviewInstruction(makeInput({ allBodies: new Map() }));
    expect(output).toContain("(no elements defined)");
  });

  it("shows body-not-available placeholder for empty body", () => {
    const output = buildReviewInstruction(
      makeInput({ allBodies: new Map([["ent-order", ""]]) })
    );
    expect(output).toContain("(body not available)");
  });
});

// ---------------------------------------------------------------------------
// Section 2: Format Rules
// ---------------------------------------------------------------------------

describe("buildReviewInstruction — format rules section", () => {
  it("output contains format rules summary text", () => {
    const output = buildReviewInstruction(makeInput());
    expect(output).toContain("Declaration syntax");
    expect(output).toContain("[[id]]");
    expect(output).toContain("ID grammar");
  });
});

// ---------------------------------------------------------------------------
// Section 3: Review Guidance
// ---------------------------------------------------------------------------

describe("buildReviewInstruction — review guidance section", () => {
  it("output contains findings format instruction (1 line per finding)", () => {
    const output = buildReviewInstruction(makeInput());
    expect(output).toContain("finding");
  });

  it("output contains verdict ownership directive (human's responsibility)", () => {
    const output = buildReviewInstruction(makeInput());
    expect(output).toContain("verdict");
    expect(output).toContain("human");
  });

  it("output contains check exclusion directive (C1-C11 out of scope)", () => {
    const output = buildReviewInstruction(makeInput());
    expect(output).toContain("C1");
    expect(output).toContain("C11");
  });

  it("output mentions structural violations excluded from review scope", () => {
    const output = buildReviewInstruction(makeInput());
    expect(output).toContain("aozu check");
  });
});

// ---------------------------------------------------------------------------
// REVIEW_GUIDANCE constant — check exclusion
// ---------------------------------------------------------------------------

describe("REVIEW_GUIDANCE", () => {
  it("is a non-empty string", () => {
    expect(typeof REVIEW_GUIDANCE).toBe("string");
    expect(REVIEW_GUIDANCE.length).toBeGreaterThan(0);
  });

  it("mentions findings format (1 line per finding)", () => {
    expect(REVIEW_GUIDANCE).toContain("finding");
  });

  it("states verdict is human's responsibility", () => {
    expect(REVIEW_GUIDANCE).toContain("verdict");
    expect(REVIEW_GUIDANCE).toContain("human");
  });

  it("explicitly excludes check's structural violations (C1-C11)", () => {
    expect(REVIEW_GUIDANCE).toContain("C1");
    expect(REVIEW_GUIDANCE).toContain("C11");
  });

  it("mentions broken references as excluded", () => {
    expect(REVIEW_GUIDANCE).toContain("reference");
  });

  it("mentions duplicate IDs as excluded", () => {
    expect(REVIEW_GUIDANCE).toContain("Duplicate");
  });

  it("mentions aozu check", () => {
    expect(REVIEW_GUIDANCE).toContain("aozu check");
  });
});

// ---------------------------------------------------------------------------
// Deterministic output
// ---------------------------------------------------------------------------

describe("buildReviewInstruction — deterministic output", () => {
  it("same input produces byte-identical output on two calls", () => {
    const input = makeInput();
    const first = buildReviewInstruction(input);
    const second = buildReviewInstruction(input);
    expect(first).toBe(second);
  });

  it("same input with multiple elements produces byte-identical output", () => {
    const input = makeInput({
      allBodies: new Map([
        ["ent-a", "body a"],
        ["ent-b", "body b"],
        ["inv-c", "body c"],
      ]),
    });
    const first = buildReviewInstruction(input);
    const second = buildReviewInstruction(input);
    expect(first).toBe(second);
  });
});
