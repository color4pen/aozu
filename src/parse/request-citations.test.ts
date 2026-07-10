/**
 * Unit tests for extractRequestCitations (T-02).
 *
 * Verifies classification of [[id]] citations in request documents into:
 *   - coverageRefs (被覆引用): references outside dependency lines
 *   - dependencyIds (依存引用): IDs declared on valid dependency lines
 *   - malformedLines: lines starting with 依存: but not matching the full grammar
 */

import { describe, it, expect } from "bun:test";
import { extractRequestCitations } from "./request-citations.ts";
import { extractReferences } from "./references.ts";

const FILE = "test/request.md";

// ---------------------------------------------------------------------------
// Dependency line parsing
// ---------------------------------------------------------------------------

describe("extractRequestCitations — dependency line parsing", () => {
  it("single dependency line → dependencyIds contains the ID", () => {
    const result = extractRequestCitations("依存: [[ent-a]]\n", FILE);
    expect(result.dependencyIds).toEqual(new Set(["ent-a"]));
    expect(result.coverageRefs).toHaveLength(0);
    expect(result.malformedLines).toHaveLength(0);
  });

  it("multiple IDs in one dependency line → all in dependencyIds", () => {
    const result = extractRequestCitations("依存: [[ent-a]], [[ent-b]]\n", FILE);
    expect(result.dependencyIds).toEqual(new Set(["ent-a", "ent-b"]));
    expect(result.coverageRefs).toHaveLength(0);
    expect(result.malformedLines).toHaveLength(0);
  });

  it("three IDs in one dependency line → all in dependencyIds", () => {
    const result = extractRequestCitations("依存: [[a]], [[b]], [[c]]\n", FILE);
    expect(result.dependencyIds).toEqual(new Set(["a", "b", "c"]));
  });

  it("multiple dependency lines → all IDs collected into dependencyIds", () => {
    const content = [
      "依存: [[ent-a]]",
      "Some body text.",
      "依存: [[ent-b]], [[ent-c]]",
    ].join("\n");
    const result = extractRequestCitations(content, FILE);
    expect(result.dependencyIds).toEqual(new Set(["ent-a", "ent-b", "ent-c"]));
    expect(result.malformedLines).toHaveLength(0);
  });

  it("duplicate ID across dependency lines → deduplicated in dependencyIds", () => {
    const content = ["依存: [[ent-a]]", "依存: [[ent-a]]"].join("\n");
    const result = extractRequestCitations(content, FILE);
    expect(result.dependencyIds).toEqual(new Set(["ent-a"]));
  });
});

// ---------------------------------------------------------------------------
// Coverage reference extraction
// ---------------------------------------------------------------------------

describe("extractRequestCitations — coverage reference extraction", () => {
  it("body citation → in coverageRefs, not in dependencyIds", () => {
    const result = extractRequestCitations("This covers [[ent-c]].\n", FILE);
    expect(result.coverageRefs.map((r) => r.targetId)).toContain("ent-c");
    expect(result.dependencyIds.has("ent-c")).toBe(false);
    expect(result.malformedLines).toHaveLength(0);
  });

  it("multiple body citations → all in coverageRefs", () => {
    const result = extractRequestCitations("[[ent-a]] and [[ent-b]] are covered.\n", FILE);
    const ids = result.coverageRefs.map((r) => r.targetId);
    expect(ids).toContain("ent-a");
    expect(ids).toContain("ent-b");
  });

  it("coverageRefs carry correct file and line info", () => {
    const result = extractRequestCitations("line1\n[[ent-x]]\nline3", FILE);
    const ref = result.coverageRefs.find((r) => r.targetId === "ent-x");
    expect(ref).toBeDefined();
    expect(ref!.file).toBe(FILE);
    expect(ref!.line).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Same ID in dependency line and body
// ---------------------------------------------------------------------------

describe("extractRequestCitations — same ID in dependency line and body", () => {
  it("ID appears in both dependency line and body → in dependencyIds AND coverageRefs", () => {
    const content = [
      "依存: [[ent-a]]",
      "This also references [[ent-a]] in the body.",
    ].join("\n");
    const result = extractRequestCitations(content, FILE);
    expect(result.dependencyIds.has("ent-a")).toBe(true);
    expect(result.coverageRefs.map((r) => r.targetId)).toContain("ent-a");
  });
});

// ---------------------------------------------------------------------------
// Malformed dependency lines
// ---------------------------------------------------------------------------

describe("extractRequestCitations — malformed dependency lines", () => {
  it("`依存: [[ent-a]] と [[ent-b]]` → malformedLines, not in coverageRefs or dependencyIds", () => {
    const line = "依存: [[ent-a]] と [[ent-b]]";
    const result = extractRequestCitations(line, FILE);
    expect(result.malformedLines).toHaveLength(1);
    expect(result.malformedLines[0]!.text).toBe(line);
    expect(result.malformedLines[0]!.line).toBe(1);
    expect(result.dependencyIds.size).toBe(0);
    expect(result.coverageRefs).toHaveLength(0);
  });

  it("`依存:` (bare keyword) → malformedLines", () => {
    const result = extractRequestCitations("依存:", FILE);
    expect(result.malformedLines).toHaveLength(1);
    expect(result.malformedLines[0]!.text).toBe("依存:");
    expect(result.dependencyIds.size).toBe(0);
  });

  it("`依存:   ` (trailing spaces) → malformedLines", () => {
    const result = extractRequestCitations("依存:   ", FILE);
    expect(result.malformedLines).toHaveLength(1);
    expect(result.dependencyIds.size).toBe(0);
  });

  it("`依存: [[ent-a]] [[ent-b]]` (missing comma) → malformedLines", () => {
    const line = "依存: [[ent-a]] [[ent-b]]";
    const result = extractRequestCitations(line, FILE);
    expect(result.malformedLines).toHaveLength(1);
    expect(result.dependencyIds.size).toBe(0);
  });

  it("malformed line reports correct line number", () => {
    const content = ["first line", "依存: invalid stuff", "third line"].join("\n");
    const result = extractRequestCitations(content, FILE);
    expect(result.malformedLines[0]!.line).toBe(2);
  });

  it("multiple malformed lines → all in malformedLines", () => {
    const content = ["依存:", "依存:   "].join("\n");
    const result = extractRequestCitations(content, FILE);
    expect(result.malformedLines).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Code fence exclusion
// ---------------------------------------------------------------------------

describe("extractRequestCitations — code fence exclusion (spec §6)", () => {
  it("dependency line inside code fence → ignored (not in dependencyIds or malformedLines)", () => {
    const content = [
      "```",
      "依存: [[ent-a]]",
      "```",
    ].join("\n");
    const result = extractRequestCitations(content, FILE);
    expect(result.dependencyIds.size).toBe(0);
    expect(result.malformedLines).toHaveLength(0);
    expect(result.coverageRefs).toHaveLength(0);
  });

  it("malformed dependency line inside code fence → ignored", () => {
    const content = [
      "```",
      "依存: [[a]] と [[b]]",
      "```",
    ].join("\n");
    const result = extractRequestCitations(content, FILE);
    expect(result.malformedLines).toHaveLength(0);
  });

  it("[[id]] inside code fence → not in coverageRefs", () => {
    const content = [
      "```",
      "[[ent-a]] should be ignored",
      "```",
      "[[ent-b]] is outside.",
    ].join("\n");
    const result = extractRequestCitations(content, FILE);
    const ids = result.coverageRefs.map((r) => r.targetId);
    expect(ids).not.toContain("ent-a");
    expect(ids).toContain("ent-b");
  });

  it("code fence toggle works correctly across multiple fences", () => {
    const content = [
      "[[ent-a]]",    // outside fence
      "```",
      "[[ent-b]]",   // inside fence
      "```",
      "[[ent-c]]",   // outside fence again
    ].join("\n");
    const result = extractRequestCitations(content, FILE);
    const ids = result.coverageRefs.map((r) => r.targetId);
    expect(ids).toContain("ent-a");
    expect(ids).not.toContain("ent-b");
    expect(ids).toContain("ent-c");
  });
});

// ---------------------------------------------------------------------------
// Inline code exclusion
// ---------------------------------------------------------------------------

describe("extractRequestCitations — inline code exclusion (spec §6)", () => {
  it("[[id]] inside inline code → not in coverageRefs", () => {
    const result = extractRequestCitations("Use `[[ent-a]]` for this.\n", FILE);
    expect(result.coverageRefs.map((r) => r.targetId)).not.toContain("ent-a");
  });

  it("[[id]] outside inline code but on same line → in coverageRefs", () => {
    const result = extractRequestCitations("Use `foo` or [[ent-a]].\n", FILE);
    expect(result.coverageRefs.map((r) => r.targetId)).toContain("ent-a");
  });
});

// ---------------------------------------------------------------------------
// Equivalence with extractReferences for dependency-free documents
// ---------------------------------------------------------------------------

describe("extractRequestCitations — equivalence for dependency-free documents", () => {
  it("document with no dependency lines: coverageRefs equals extractReferences result", () => {
    const content = [
      "# My Request",
      "",
      "This covers [[mod-parse]] and uses `[[mod-cli]]` inline.",
      "",
      "```",
      "[[mod-graph]] in code fence",
      "```",
      "",
      "Also [[mod-plan]].",
    ].join("\n");

    const legacy = extractReferences(content, FILE);
    const result = extractRequestCitations(content, FILE);

    // Both should see the same targetIds
    const legacyIds = legacy.map((r) => r.targetId).sort();
    const coverageIds = result.coverageRefs.map((r) => r.targetId).sort();
    expect(coverageIds).toEqual(legacyIds);

    expect(result.dependencyIds.size).toBe(0);
    expect(result.malformedLines).toHaveLength(0);
  });

  it("empty document → all collections empty", () => {
    const result = extractRequestCitations("", FILE);
    expect(result.coverageRefs).toHaveLength(0);
    expect(result.dependencyIds.size).toBe(0);
    expect(result.malformedLines).toHaveLength(0);
  });

  it("document with only prose (no [[id]]) → all collections empty", () => {
    const result = extractRequestCitations("No citations here.\n", FILE);
    expect(result.coverageRefs).toHaveLength(0);
    expect(result.dependencyIds.size).toBe(0);
    expect(result.malformedLines).toHaveLength(0);
  });
});
