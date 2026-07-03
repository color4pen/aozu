/**
 * Tests for src/prompt/shared.ts
 * Covers: SCOPE_MAX_HOPS, FORMAT_RULES_SUMMARY, collectTermsAndInvariants,
 * collectStaticModulesSummary.
 */

import { describe, it, expect } from "bun:test";
import {
  SCOPE_MAX_HOPS,
  FORMAT_RULES_SUMMARY,
  collectTermsAndInvariants,
  collectStaticModulesSummary,
} from "./shared.ts";
import type { Graph } from "../graph/types.ts";
import type { FileInput } from "../parse/types.ts";

// ---------------------------------------------------------------------------
// Minimal mock builders
// ---------------------------------------------------------------------------

/**
 * Build a minimal Graph mock with a set of elements.
 * Each entry: { id, prefix, file, line }.
 */
function makeGraph(
  elements: Array<{ id: string; prefix: string; file: string; line: number }>
): Graph {
  const elementMap = new Map<string, { id: string; prefix: string; displayName: string; file: string; line: number }>();
  for (const el of elements) {
    elementMap.set(el.id, {
      id: el.id,
      prefix: el.prefix,
      displayName: el.id,
      file: el.file,
      line: el.line,
    });
  }
  return {
    elements: elementMap,
    rawElements: [],
    references: { bySource: new Map(), byTarget: new Map(), all: [] },
    dependencyEdges: [],
    actorIds: [],
    elementItems: [],
    implementations: [],
    manifestPath: null,
  } as unknown as Graph;
}

/**
 * Build a minimal FileInput mock.
 */
function makeFile(path: string, content: string): FileInput {
  return { path, content };
}

// ---------------------------------------------------------------------------
// collectTermsAndInvariants
// ---------------------------------------------------------------------------

describe("collectTermsAndInvariants", () => {
  it("returns empty string when no term or inv elements exist", () => {
    const graph = makeGraph([
      { id: "mod-core", prefix: "mod", file: "/design/static/modules.md", line: 3 },
      { id: "ent-order", prefix: "ent", file: "/design/domain/model.md", line: 3 },
    ]);
    const files: FileInput[] = [
      makeFile("/design/static/modules.md", "# Static\n\n## Core {#mod-core}\n責務: コアロジック\n"),
      makeFile("/design/domain/model.md", "# Domain\n\n## Order {#ent-order}\n注文の説明。\n"),
    ];
    const result = collectTermsAndInvariants(graph, files);
    expect(result).toBe("");
  });

  it("includes term and inv elements in ID lexicographic order", () => {
    const graph = makeGraph([
      { id: "term-status", prefix: "term", file: "/design/domain/glossary.md", line: 3 },
      { id: "inv-order-valid", prefix: "inv", file: "/design/domain/invariants.md", line: 3 },
    ]);
    const files: FileInput[] = [
      makeFile(
        "/design/domain/glossary.md",
        "# 用語集\n\n## ステータス {#term-status}\n注文の状態を表す。\n"
      ),
      makeFile(
        "/design/domain/invariants.md",
        "# 不変条件\n\n## 注文有効性 {#inv-order-valid}\n注文は必ず顧客 ID を持つ。\n"
      ),
    ];
    const result = collectTermsAndInvariants(graph, files);
    // ID lexicographic order: inv-order-valid < term-status
    const invIdx = result.indexOf("inv-order-valid");
    const termIdx = result.indexOf("term-status");
    expect(invIdx).toBeGreaterThanOrEqual(0);
    expect(termIdx).toBeGreaterThanOrEqual(0);
    expect(invIdx).toBeLessThan(termIdx);
  });

  it("formats each entry as '### id\\nbody'", () => {
    const graph = makeGraph([
      { id: "inv-order-valid", prefix: "inv", file: "/design/domain/invariants.md", line: 3 },
    ]);
    const files: FileInput[] = [
      makeFile(
        "/design/domain/invariants.md",
        "# 不変条件\n\n## 注文有効性 {#inv-order-valid}\n注文は必ず顧客 ID を持つ。\n"
      ),
    ];
    const result = collectTermsAndInvariants(graph, files);
    expect(result).toContain("### inv-order-valid");
    expect(result).toContain("顧客 ID");
  });

  it("uses placeholder when body is unavailable", () => {
    const graph = makeGraph([
      { id: "inv-missing-file", prefix: "inv", file: "/design/domain/missing.md", line: 3 },
    ]);
    // No matching file in files[]
    const files: FileInput[] = [];
    const result = collectTermsAndInvariants(graph, files);
    expect(result).toContain("### inv-missing-file");
    expect(result).toContain("(body not available)");
  });

  it("separates multiple entries with double newline", () => {
    const graph = makeGraph([
      { id: "inv-a", prefix: "inv", file: "/design/invariants.md", line: 3 },
      { id: "term-b", prefix: "term", file: "/design/glossary.md", line: 3 },
    ]);
    const files: FileInput[] = [
      makeFile("/design/invariants.md", "# Inv\n\n## A {#inv-a}\nbody-a\n"),
      makeFile("/design/glossary.md", "# Term\n\n## B {#term-b}\nbody-b\n"),
    ];
    const result = collectTermsAndInvariants(graph, files);
    expect(result).toContain("\n\n");
    expect(result).toContain("inv-a");
    expect(result).toContain("term-b");
  });

  it("does not include non-term/inv elements", () => {
    const graph = makeGraph([
      { id: "mod-core", prefix: "mod", file: "/design/modules.md", line: 3 },
      { id: "inv-order-valid", prefix: "inv", file: "/design/invariants.md", line: 3 },
    ]);
    const files: FileInput[] = [
      makeFile("/design/modules.md", "# Static\n\n## Core {#mod-core}\n責務: コアロジック\n"),
      makeFile("/design/invariants.md", "# Inv\n\n## Valid {#inv-order-valid}\n顧客 ID を持つ。\n"),
    ];
    const result = collectTermsAndInvariants(graph, files);
    expect(result).toContain("inv-order-valid");
    expect(result).not.toContain("mod-core");
  });
});

// ---------------------------------------------------------------------------
// collectStaticModulesSummary
// ---------------------------------------------------------------------------

describe("collectStaticModulesSummary", () => {
  it("returns empty string when no mod elements exist", () => {
    const graph = makeGraph([
      { id: "ent-order", prefix: "ent", file: "/design/domain/model.md", line: 3 },
    ]);
    const files: FileInput[] = [
      makeFile("/design/domain/model.md", "# Domain\n\n## Order {#ent-order}\n注文。\n"),
    ];
    const result = collectStaticModulesSummary(graph, files);
    expect(result).toBe("");
  });

  it("includes mod elements in ID lexicographic order", () => {
    const graph = makeGraph([
      { id: "mod-core", prefix: "mod", file: "/design/static/modules.md", line: 3 },
      { id: "mod-cli", prefix: "mod", file: "/design/static/modules.md", line: 7 },
    ]);
    const files: FileInput[] = [
      makeFile(
        "/design/static/modules.md",
        [
          "# モジュール",
          "",
          "## コア {#mod-core}",
          "責務: コアロジック",
          "実装: src/core/",
          "",
          "## CLI {#mod-cli}",
          "責務: CLI インターフェース",
          "実装: src/cli/",
        ].join("\n")
      ),
    ];
    const result = collectStaticModulesSummary(graph, files);
    // ID lexicographic order: mod-cli < mod-core
    const cliIdx = result.indexOf("mod-cli");
    const coreIdx = result.indexOf("mod-core");
    expect(cliIdx).toBeGreaterThanOrEqual(0);
    expect(coreIdx).toBeGreaterThanOrEqual(0);
    expect(cliIdx).toBeLessThan(coreIdx);
  });

  it("formats each entry as '### id\\n責務: ...'", () => {
    const graph = makeGraph([
      { id: "mod-core", prefix: "mod", file: "/design/static/modules.md", line: 3 },
    ]);
    const files: FileInput[] = [
      makeFile(
        "/design/static/modules.md",
        "# モジュール\n\n## コア {#mod-core}\n責務: コアロジック\n実装: src/core/\n"
      ),
    ];
    const result = collectStaticModulesSummary(graph, files);
    expect(result).toContain("### mod-core");
    expect(result).toContain("責務: コアロジック");
  });

  it("excludes 実装: lines (condensed form)", () => {
    const graph = makeGraph([
      { id: "mod-core", prefix: "mod", file: "/design/static/modules.md", line: 3 },
    ]);
    const files: FileInput[] = [
      makeFile(
        "/design/static/modules.md",
        "# モジュール\n\n## コア {#mod-core}\n責務: コアロジック\n実装: src/core/\n"
      ),
    ];
    const result = collectStaticModulesSummary(graph, files);
    expect(result).not.toContain("実装:");
  });

  it("uses placeholder when no 責務: line found", () => {
    const graph = makeGraph([
      { id: "mod-noduty", prefix: "mod", file: "/design/static/modules.md", line: 3 },
    ]);
    const files: FileInput[] = [
      makeFile(
        "/design/static/modules.md",
        "# モジュール\n\n## No duty {#mod-noduty}\nThis module has no duty line.\n"
      ),
    ];
    const result = collectStaticModulesSummary(graph, files);
    expect(result).toContain("### mod-noduty");
    expect(result).toContain("(no 責務: line found)");
  });

  it("does not include non-mod elements", () => {
    const graph = makeGraph([
      { id: "mod-core", prefix: "mod", file: "/design/modules.md", line: 3 },
      { id: "inv-valid", prefix: "inv", file: "/design/invariants.md", line: 3 },
    ]);
    const files: FileInput[] = [
      makeFile("/design/modules.md", "# Static\n\n## Core {#mod-core}\n責務: コアロジック\n"),
      makeFile("/design/invariants.md", "# Inv\n\n## Valid {#inv-valid}\n不変条件。\n"),
    ];
    const result = collectStaticModulesSummary(graph, files);
    expect(result).toContain("mod-core");
    expect(result).not.toContain("inv-valid");
  });
});

// ---------------------------------------------------------------------------
// SCOPE_MAX_HOPS
// ---------------------------------------------------------------------------

describe("SCOPE_MAX_HOPS", () => {
  it("is 2", () => {
    expect(SCOPE_MAX_HOPS).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// FORMAT_RULES_SUMMARY
// ---------------------------------------------------------------------------

describe("FORMAT_RULES_SUMMARY", () => {
  it("is a non-empty string", () => {
    expect(typeof FORMAT_RULES_SUMMARY).toBe("string");
    expect(FORMAT_RULES_SUMMARY.length).toBeGreaterThan(0);
  });

  it("contains declaration syntax section", () => {
    expect(FORMAT_RULES_SUMMARY).toContain("Declaration syntax");
  });

  it("contains [[id]] reference syntax", () => {
    expect(FORMAT_RULES_SUMMARY).toContain("[[id]]");
  });

  it("contains ID grammar section", () => {
    expect(FORMAT_RULES_SUMMARY).toContain("ID grammar");
  });

  it("contains type prefix table with all prefixes", () => {
    expect(FORMAT_RULES_SUMMARY).toContain("mod");
    expect(FORMAT_RULES_SUMMARY).toContain("term");
    expect(FORMAT_RULES_SUMMARY).toContain("ent");
    expect(FORMAT_RULES_SUMMARY).toContain("inv");
    expect(FORMAT_RULES_SUMMARY).toContain("adr");
  });

  it("contains frontmatter convention", () => {
    expect(FORMAT_RULES_SUMMARY).toContain("frontmatter");
  });
});
