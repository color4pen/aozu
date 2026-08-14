/**
 * Tests for op-element implementation: TC-017 through TC-020
 *
 * Covers:
 *   TC Group 8: spec/format.md documentation — C11 domain listing and perm target constraint
 *   TC Group 9: JSDoc and test name hygiene
 *
 * These tests read actual source files and verify their content has been
 * updated. Pre-implementation: files contain old content → assertions fail → RED.
 */

import { describe, expect, it } from "bun:test";
import { join } from "path";
import { readFileSync } from "fs";

const REPO_ROOT = join(import.meta.dir, "../..");

describe("TC-017: C11 domain listing in spec/format.md includes op", () => {
  it("TC-017: spec/format.md C11 row lists 'op' among domain-layer prefixes", () => {
    // After implementation: spec/format.md §10 C11 should read:
    //   "domain（term / ent / inv / act / op）のみを参照できる"
    // Pre-implementation: reads "term / ent / inv / act" (no op) → RED.
    const specContent = readFileSync(
      join(REPO_ROOT, "spec/format.md"),
      "utf-8"
    );
    // C11 domain listing must include op
    expect(specContent).toContain("term / ent / inv / act / op");
  });
});

describe("TC-018: perm target single-reference constraint documented in spec/format.md", () => {
  it("TC-018: spec/format.md mentions single-reference constraint for perm 対象: line", () => {
    // After implementation:
    //   §8 perm schema should say single-reference and C6 violation for multiple references.
    //   §10 C6 should list "perm 対象行の単一制約".
    // Pre-implementation: spec does not mention "単一参照" for perm 対象: → RED.
    const specContent = readFileSync(
      join(REPO_ROOT, "spec/format.md"),
      "utf-8"
    );
    // Both §8 and §10 must mention the single-reference constraint
    expect(specContent).toContain("単一参照");
  });
});

describe("TC-019: PermOperation JSDoc reflects new [[op-id]] grammar", () => {
  it("TC-019: src/parse/types.ts PermOperation comment shows [[op-id]]: [[act-id]] format", () => {
    // After implementation: PermOperation JSDoc comment should reference the new format.
    // Pre-implementation: comment says "- <operation>: [[act-id]]..." (no [[op-id]]) → RED.
    const typesContent = readFileSync(
      join(REPO_ROOT, "src/parse/types.ts"),
      "utf-8"
    );
    // The JSDoc for PermOperation should show the [[op-id]] syntax
    expect(typesContent).toMatch(/\[\[op-id\]\].*\[\[act-id\]\]/);
  });
});

describe("TC-020: export permissions test name does not reference 'spec §8'", () => {
  it("TC-020: src/export/permissions.test.ts test name updated to remove 'spec §8 example'", () => {
    // After implementation: the test previously named
    //   "spec §8 example: perm-deal with list and create"
    // should have the "spec §8 example:" prefix removed.
    // Pre-implementation: old name still exists → assertion fails → RED.
    const testContent = readFileSync(
      join(REPO_ROOT, "src/export/permissions.test.ts"),
      "utf-8"
    );
    expect(testContent).not.toContain("spec §8 example");
  });
});
