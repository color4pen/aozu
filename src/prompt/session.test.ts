/**
 * Tests for src/prompt/session.ts — buildSessionInstruction.
 */

import { describe, it, expect } from "bun:test";
import {
  buildSessionInstruction,
  FORMAT_RULES_SUMMARY,
  SESSION_GUIDANCE,
  SESSION_MAX_HOPS,
  type SessionInput,
} from "./session.ts";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<SessionInput> = {}): SessionInput {
  return {
    topicId: "top-my-topic",
    topicBody: "This is the topic body text describing the problem.",
    seedBodies: new Map([
      ["ent-order", "注文エンティティ。[[inv-order-valid]] を満たす。"],
    ]),
    neighborBodies: new Map([
      ["inv-order-valid", "注文は必ず顧客 ID を持つ。"],
    ]),
    termsAndInvariants: "### term-status\n注文の状態を表す。\n\n### inv-order-valid\n注文は必ず顧客 ID を持つ。",
    staticModulesSummary: "### mod-core\n責務: コアロジック\n\n### mod-cli\n責務: CLI インターフェース",
    enabledLayers: ["static", "domain", "dynamic", "loop"],
    formatRulesSummary: FORMAT_RULES_SUMMARY,
    sessionGuidance: SESSION_GUIDANCE,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Section 1: Topic
// ---------------------------------------------------------------------------

describe("buildSessionInstruction — topic section", () => {
  it("output contains '## Topic' section header", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("## Topic");
  });

  it("output contains topicId in the topic section", () => {
    const output = buildSessionInstruction(makeInput({ topicId: "top-my-topic" }));
    expect(output).toContain("top-my-topic");
  });

  it("output contains topicBody text in the topic section", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("This is the topic body text describing the problem.");
  });
});

// ---------------------------------------------------------------------------
// Section 2: Seed Element Bodies
// ---------------------------------------------------------------------------

describe("buildSessionInstruction — seed element bodies section", () => {
  it("output contains '## Seed Element Bodies' section header", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("## Seed Element Bodies");
  });

  it("output contains seed element ID as subsection header", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("### ent-order");
  });

  it("output contains seed element body text", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("注文エンティティ");
  });

  it("shows placeholder when seedBodies is empty", () => {
    const output = buildSessionInstruction(makeInput({ seedBodies: new Map() }));
    expect(output).toContain("(no seed elements — topic has no [[id]] citations)");
  });
});

// ---------------------------------------------------------------------------
// Section 3: Neighborhood Element Bodies (2-hop)
// ---------------------------------------------------------------------------

describe("buildSessionInstruction — neighborhood element bodies section", () => {
  it("output contains '## Neighborhood Element Bodies (2-hop)' section header", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("## Neighborhood Element Bodies (2-hop)");
  });

  it("output contains neighborhood element ID as subsection header", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("### inv-order-valid");
  });

  it("output contains neighborhood element body text", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("注文は必ず顧客 ID を持つ");
  });

  it("shows placeholder when neighborBodies is empty", () => {
    const output = buildSessionInstruction(makeInput({ neighborBodies: new Map() }));
    expect(output).toContain("(no neighborhood elements)");
  });
});

// ---------------------------------------------------------------------------
// Section 4: Terms and Invariants
// ---------------------------------------------------------------------------

describe("buildSessionInstruction — terms and invariants section", () => {
  it("output contains '## Terms and Invariants' section header", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("## Terms and Invariants");
  });

  it("output contains terms and invariants text", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("注文の状態を表す");
    expect(output).toContain("term-status");
  });

  it("shows placeholder when termsAndInvariants is empty", () => {
    const output = buildSessionInstruction(makeInput({ termsAndInvariants: "" }));
    expect(output).toContain("(no terms or invariants defined)");
  });
});

// ---------------------------------------------------------------------------
// Section 5: Static Modules
// ---------------------------------------------------------------------------

describe("buildSessionInstruction — static modules section", () => {
  it("output contains '## Static Modules' section header", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("## Static Modules");
  });

  it("output contains static module summary text", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("mod-core");
    expect(output).toContain("コアロジック");
  });
});

// ---------------------------------------------------------------------------
// Section 6: Enabled Layers
// ---------------------------------------------------------------------------

describe("buildSessionInstruction — enabled layers section", () => {
  it("output contains '## Enabled Layers' section header", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("## Enabled Layers");
  });

  it("output contains enabled layer names", () => {
    const output = buildSessionInstruction(
      makeInput({ enabledLayers: ["static", "domain", "dynamic", "loop"] })
    );
    expect(output).toContain("static, domain, dynamic, loop");
  });
});

// ---------------------------------------------------------------------------
// Section 7: Format Rules
// ---------------------------------------------------------------------------

describe("buildSessionInstruction — format rules section", () => {
  it("output contains '## Format Rules' section header", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("## Format Rules");
  });

  it("output contains format rules summary text", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("Declaration syntax");
    expect(output).toContain("[[id]]");
    expect(output).toContain("ID grammar");
  });
});

// ---------------------------------------------------------------------------
// Section 8: Session Guidance
// ---------------------------------------------------------------------------

describe("buildSessionInstruction — session guidance section", () => {
  it("output contains '## Session Guidance' section header", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("## Session Guidance");
  });

  it("output contains session guidance text about scaffold", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("scaffold");
  });

  it("output contains session guidance text about check", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("check");
  });

  it("output contains session guidance text about ADR", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("ADR");
  });

  it("output contains session guidance text about topics: citation (ADR-0018)", () => {
    const output = buildSessionInstruction(makeInput());
    expect(output).toContain("topics:");
  });
});

// ---------------------------------------------------------------------------
// Empty input fallback tests
// ---------------------------------------------------------------------------

describe("buildSessionInstruction — empty input fallbacks", () => {
  it("seedBodies empty → placeholder contains 'no seed elements'", () => {
    const output = buildSessionInstruction(makeInput({ seedBodies: new Map() }));
    expect(output).toContain("no seed elements");
  });

  it("neighborBodies empty → '(no neighborhood elements)'", () => {
    const output = buildSessionInstruction(makeInput({ neighborBodies: new Map() }));
    expect(output).toContain("(no neighborhood elements)");
  });

  it("termsAndInvariants empty → '(no terms or invariants defined)'", () => {
    const output = buildSessionInstruction(makeInput({ termsAndInvariants: "" }));
    expect(output).toContain("(no terms or invariants defined)");
  });
});

// ---------------------------------------------------------------------------
// All 8 sections present (integration)
// ---------------------------------------------------------------------------

describe("buildSessionInstruction — all 8 sections", () => {
  it("output contains all 8 required sections", () => {
    const output = buildSessionInstruction(makeInput());
    // 1. Topic
    expect(output).toContain("## Topic");
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
    // 8. Session Guidance
    expect(output).toContain("## Session Guidance");
  });
});

// ---------------------------------------------------------------------------
// Deterministic output test
// ---------------------------------------------------------------------------

describe("buildSessionInstruction — deterministic output", () => {
  it("same input produces byte-identical output on two calls", () => {
    const input = makeInput();
    const first = buildSessionInstruction(input);
    const second = buildSessionInstruction(input);
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
    const first = buildSessionInstruction(input);
    const second = buildSessionInstruction(input);
    expect(first).toBe(second);
  });
});

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

describe("exported constants", () => {
  it("SESSION_MAX_HOPS is 2", () => {
    expect(SESSION_MAX_HOPS).toBe(2);
  });

  it("FORMAT_RULES_SUMMARY is a non-empty string", () => {
    expect(typeof FORMAT_RULES_SUMMARY).toBe("string");
    expect(FORMAT_RULES_SUMMARY.length).toBeGreaterThan(0);
  });

  it("FORMAT_RULES_SUMMARY contains declaration syntax", () => {
    expect(FORMAT_RULES_SUMMARY).toContain("Declaration syntax");
  });

  it("FORMAT_RULES_SUMMARY contains reference syntax with [[id]]", () => {
    expect(FORMAT_RULES_SUMMARY).toContain("[[id]]");
  });

  it("FORMAT_RULES_SUMMARY contains ID grammar", () => {
    expect(FORMAT_RULES_SUMMARY).toContain("ID grammar");
  });

  it("FORMAT_RULES_SUMMARY contains type prefix table with all prefixes", () => {
    expect(FORMAT_RULES_SUMMARY).toContain("mod");
    expect(FORMAT_RULES_SUMMARY).toContain("term");
    expect(FORMAT_RULES_SUMMARY).toContain("ent");
    expect(FORMAT_RULES_SUMMARY).toContain("inv");
    expect(FORMAT_RULES_SUMMARY).toContain("act");
    expect(FORMAT_RULES_SUMMARY).toContain("seq");
    expect(FORMAT_RULES_SUMMARY).toContain("top");
    expect(FORMAT_RULES_SUMMARY).toContain("plan");
    expect(FORMAT_RULES_SUMMARY).toContain("grp");
    expect(FORMAT_RULES_SUMMARY).toContain("adr");
  });

  it("FORMAT_RULES_SUMMARY contains frontmatter convention", () => {
    expect(FORMAT_RULES_SUMMARY).toContain("frontmatter");
  });

  it("SESSION_GUIDANCE is a non-empty string", () => {
    expect(typeof SESSION_GUIDANCE).toBe("string");
    expect(SESSION_GUIDANCE.length).toBeGreaterThan(0);
  });

  it("SESSION_GUIDANCE mentions scaffold", () => {
    expect(SESSION_GUIDANCE).toContain("scaffold");
  });

  it("SESSION_GUIDANCE mentions ADR", () => {
    expect(SESSION_GUIDANCE).toContain("ADR");
  });

  it("SESSION_GUIDANCE mentions topics: citation (ADR-0018)", () => {
    expect(SESSION_GUIDANCE).toContain("topics:");
  });
});
