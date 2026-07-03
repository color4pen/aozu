/**
 * Tests for src/prompt/propagate.ts — buildPropagateInstruction.
 */

import { describe, it, expect } from "bun:test";
import {
  buildPropagateInstruction,
  PROPAGATE_GUIDANCE,
  type PropagateInput,
} from "./propagate.ts";
import { FORMAT_RULES_SUMMARY } from "./shared.ts";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<PropagateInput> = {}): PropagateInput {
  return {
    adrId: "adr-0001",
    adrBody:
      "## Decision\n\nWe decided to use [[ent-order]] as the primary entity.\n\ntopics: top-my-topic",
    seedBodies: new Map([
      ["ent-order", "注文エンティティ。[[inv-order-valid]] を満たす。"],
    ]),
    neighborBodies: new Map([
      ["inv-order-valid", "注文は必ず顧客 ID を持つ。"],
    ]),
    termsAndInvariants:
      "### term-status\n注文の状態を表す。\n\n### inv-order-valid\n注文は必ず顧客 ID を持つ。",
    staticModulesSummary: "### mod-core\n責務: コアロジック\n\n### mod-cli\n責務: CLI インターフェース",
    enabledLayers: ["static", "domain", "dynamic", "loop"],
    formatRulesSummary: FORMAT_RULES_SUMMARY,
    propagateGuidance: PROPAGATE_GUIDANCE,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// All 8 sections present
// ---------------------------------------------------------------------------

describe("buildPropagateInstruction — all 8 sections", () => {
  it("output contains all 8 required section headers", () => {
    const output = buildPropagateInstruction(makeInput());
    // 1. ADR
    expect(output).toContain("## ADR");
    // 2. Seed Element Bodies
    expect(output).toContain("## Seed Element Bodies");
    // 3. Neighborhood Element Bodies (2-hop)
    expect(output).toContain("## Neighborhood Element Bodies (2-hop)");
    // 4. Terms and Invariants
    expect(output).toContain("## Terms and Invariants");
    // 5. Static Modules
    expect(output).toContain("## Static Modules");
    // 6. Enabled Layers
    expect(output).toContain("## Enabled Layers");
    // 7. Format Rules
    expect(output).toContain("## Format Rules");
    // 8. Propagation Guidance
    expect(output).toContain("## Propagation Guidance");
  });
});

// ---------------------------------------------------------------------------
// Section 1: ADR
// ---------------------------------------------------------------------------

describe("buildPropagateInstruction — ADR section", () => {
  it("output contains ADR ID", () => {
    const output = buildPropagateInstruction(makeInput({ adrId: "adr-0001" }));
    expect(output).toContain("adr-0001");
  });

  it("output contains ADR body text", () => {
    const output = buildPropagateInstruction(makeInput());
    expect(output).toContain("primary entity");
  });

  it("shows placeholder when ADR body is empty", () => {
    const output = buildPropagateInstruction(makeInput({ adrBody: "" }));
    expect(output).toContain("(no ADR body)");
  });
});

// ---------------------------------------------------------------------------
// Section 2: Seed Element Bodies
// ---------------------------------------------------------------------------

describe("buildPropagateInstruction — seed element bodies section", () => {
  it("output contains seed element ID as subsection header", () => {
    const output = buildPropagateInstruction(makeInput());
    expect(output).toContain("### ent-order");
  });

  it("output contains seed element body text", () => {
    const output = buildPropagateInstruction(makeInput());
    expect(output).toContain("注文エンティティ");
  });

  it("shows placeholder when seedBodies is empty", () => {
    const output = buildPropagateInstruction(makeInput({ seedBodies: new Map() }));
    expect(output).toContain("(no seed elements — ADR has no [[id]] citations)");
  });

  it("shows body-not-available placeholder for empty body in seed", () => {
    const output = buildPropagateInstruction(
      makeInput({ seedBodies: new Map([["ent-order", ""]]) })
    );
    expect(output).toContain("(body not available)");
  });
});

// ---------------------------------------------------------------------------
// Section 3: Neighborhood Element Bodies (2-hop)
// ---------------------------------------------------------------------------

describe("buildPropagateInstruction — neighborhood element bodies section", () => {
  it("output contains neighborhood element ID as subsection header", () => {
    const output = buildPropagateInstruction(makeInput());
    expect(output).toContain("### inv-order-valid");
  });

  it("output contains neighborhood element body text", () => {
    const output = buildPropagateInstruction(makeInput());
    expect(output).toContain("顧客 ID");
  });

  it("shows placeholder when neighborBodies is empty", () => {
    const output = buildPropagateInstruction(makeInput({ neighborBodies: new Map() }));
    expect(output).toContain("(no neighborhood elements)");
  });
});

// ---------------------------------------------------------------------------
// Section 4: Terms and Invariants
// ---------------------------------------------------------------------------

describe("buildPropagateInstruction — terms and invariants section", () => {
  it("output contains terms and invariants text", () => {
    const output = buildPropagateInstruction(makeInput());
    expect(output).toContain("注文の状態を表す");
    expect(output).toContain("term-status");
  });

  it("shows placeholder when termsAndInvariants is empty", () => {
    const output = buildPropagateInstruction(makeInput({ termsAndInvariants: "" }));
    expect(output).toContain("(no terms or invariants defined)");
  });
});

// ---------------------------------------------------------------------------
// Section 5: Static Modules
// ---------------------------------------------------------------------------

describe("buildPropagateInstruction — static modules section", () => {
  it("output contains static module summary text", () => {
    const output = buildPropagateInstruction(makeInput());
    expect(output).toContain("mod-core");
    expect(output).toContain("コアロジック");
  });

  it("shows placeholder when staticModulesSummary is empty", () => {
    const output = buildPropagateInstruction(makeInput({ staticModulesSummary: "" }));
    expect(output).toContain("(no static modules defined)");
  });
});

// ---------------------------------------------------------------------------
// Section 6: Enabled Layers
// ---------------------------------------------------------------------------

describe("buildPropagateInstruction — enabled layers section", () => {
  it("output contains enabled layer names", () => {
    const output = buildPropagateInstruction(
      makeInput({ enabledLayers: ["static", "domain", "dynamic", "loop"] })
    );
    expect(output).toContain("static, domain, dynamic, loop");
  });

  it("shows (none) when enabledLayers is empty", () => {
    const output = buildPropagateInstruction(makeInput({ enabledLayers: [] }));
    expect(output).toContain("(none)");
  });
});

// ---------------------------------------------------------------------------
// Section 7: Format Rules
// ---------------------------------------------------------------------------

describe("buildPropagateInstruction — format rules section", () => {
  it("output contains format rules summary text", () => {
    const output = buildPropagateInstruction(makeInput());
    expect(output).toContain("Declaration syntax");
    expect(output).toContain("[[id]]");
    expect(output).toContain("ID grammar");
  });
});

// ---------------------------------------------------------------------------
// Section 8: Propagation Guidance
// ---------------------------------------------------------------------------

describe("buildPropagateInstruction — propagation guidance section", () => {
  it("output contains propagation guidance text about aozu check", () => {
    const output = buildPropagateInstruction(makeInput());
    expect(output).toContain("aozu check");
  });

  it("output contains propagation guidance about completion condition", () => {
    const output = buildPropagateInstruction(makeInput());
    expect(output).toContain("exit");
  });

  it("output contains propagation guidance about citing changed elements", () => {
    const output = buildPropagateInstruction(makeInput());
    expect(output).toContain("[[id]]");
  });
});

// ---------------------------------------------------------------------------
// Empty input fallbacks
// ---------------------------------------------------------------------------

describe("buildPropagateInstruction — empty input fallbacks", () => {
  it("seedBodies empty → placeholder contains 'no seed elements'", () => {
    const output = buildPropagateInstruction(makeInput({ seedBodies: new Map() }));
    expect(output).toContain("no seed elements");
  });

  it("neighborBodies empty → '(no neighborhood elements)'", () => {
    const output = buildPropagateInstruction(makeInput({ neighborBodies: new Map() }));
    expect(output).toContain("(no neighborhood elements)");
  });

  it("termsAndInvariants empty → '(no terms or invariants defined)'", () => {
    const output = buildPropagateInstruction(makeInput({ termsAndInvariants: "" }));
    expect(output).toContain("(no terms or invariants defined)");
  });

  it("staticModulesSummary empty → '(no static modules defined)'", () => {
    const output = buildPropagateInstruction(makeInput({ staticModulesSummary: "" }));
    expect(output).toContain("(no static modules defined)");
  });
});

// ---------------------------------------------------------------------------
// Deterministic output
// ---------------------------------------------------------------------------

describe("buildPropagateInstruction — deterministic output", () => {
  it("same input produces byte-identical output on two calls", () => {
    const input = makeInput();
    const first = buildPropagateInstruction(input);
    const second = buildPropagateInstruction(input);
    expect(first).toBe(second);
  });

  it("same input with multiple seed/neighbor entries produces byte-identical output", () => {
    const input = makeInput({
      seedBodies: new Map([
        ["ent-a", "body a"],
        ["ent-b", "body b"],
      ]),
      neighborBodies: new Map([
        ["inv-x", "inv body"],
        ["mod-y", "mod body"],
      ]),
    });
    const first = buildPropagateInstruction(input);
    const second = buildPropagateInstruction(input);
    expect(first).toBe(second);
  });
});

// ---------------------------------------------------------------------------
// PROPAGATE_GUIDANCE constant
// ---------------------------------------------------------------------------

describe("PROPAGATE_GUIDANCE", () => {
  it("is a non-empty string", () => {
    expect(typeof PROPAGATE_GUIDANCE).toBe("string");
    expect(PROPAGATE_GUIDANCE.length).toBeGreaterThan(0);
  });

  it("mentions aozu check", () => {
    expect(PROPAGATE_GUIDANCE).toContain("aozu check");
  });

  it("mentions completion condition (check exit 0)", () => {
    expect(PROPAGATE_GUIDANCE).toContain("exit");
  });

  it("mentions [[id]] citation", () => {
    expect(PROPAGATE_GUIDANCE).toContain("[[id]]");
  });
});
