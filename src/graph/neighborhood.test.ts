/**
 * Tests for src/graph/neighborhood.ts — computeNeighborhood.
 */

import { describe, it, expect } from "bun:test";
import { computeNeighborhood } from "./neighborhood.ts";
import { buildGraph } from "./builder.ts";
import { parseFiles } from "../parse/parser.ts";
import type { FileInput } from "../parse/types.ts";

function makeFiles(entries: Array<[string, string]>): FileInput[] {
  return entries.map(([path, content]) => ({ path, content }));
}

// ---------------------------------------------------------------------------
// Fixture: A → B → C (chain), and D → A (in-reference to A)
//
// modules.md:
//   mod-a: references [[mod-b]]
//   mod-b: references [[mod-c]]
//   mod-c: (no refs)
//   mod-d: references [[mod-a]]
// ---------------------------------------------------------------------------

function makeChainFixture(): FileInput[] {
  return makeFiles([
    [
      "modules.md",
      [
        "# モジュール",
        "",
        "## A {#mod-a}",
        "責務: A。参照: [[mod-b]]",
        "実装: src/a/",
        "",
        "## B {#mod-b}",
        "責務: B。参照: [[mod-c]]",
        "実装: src/b/",
        "",
        "## C {#mod-c}",
        "責務: C",
        "実装: src/c/",
        "",
        "## D {#mod-d}",
        "責務: D。参照: [[mod-a]]",
        "実装: src/d/",
      ].join("\n"),
    ],
  ]);
}

// ---------------------------------------------------------------------------
// 1-hop neighborhood
// ---------------------------------------------------------------------------

describe("computeNeighborhood — 1-hop", () => {
  it("includes direct out-references (A→B)", () => {
    const files = makeChainFixture();
    const graph = buildGraph(parseFiles(files));

    const neighbors = computeNeighborhood(["mod-a"], graph, 1);
    expect(neighbors.has("mod-b")).toBe(true);
  });

  it("includes direct in-references (D→A means A's 1-hop includes D)", () => {
    const files = makeChainFixture();
    const graph = buildGraph(parseFiles(files));

    const neighbors = computeNeighborhood(["mod-a"], graph, 1);
    expect(neighbors.has("mod-d")).toBe(true);
  });

  it("does NOT include 2-hop neighbors at maxHops=1 (A→B→C, C not reachable)", () => {
    const files = makeChainFixture();
    const graph = buildGraph(parseFiles(files));

    const neighbors = computeNeighborhood(["mod-a"], graph, 1);
    expect(neighbors.has("mod-c")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2-hop neighborhood
// ---------------------------------------------------------------------------

describe("computeNeighborhood — 2-hop", () => {
  it("includes 2nd-hop out-references (A→B→C)", () => {
    const files = makeChainFixture();
    const graph = buildGraph(parseFiles(files));

    const neighbors = computeNeighborhood(["mod-a"], graph, 2);
    expect(neighbors.has("mod-b")).toBe(true);
    expect(neighbors.has("mod-c")).toBe(true);
  });

  it("includes 1st-hop in-references from 2-hop start", () => {
    const files = makeChainFixture();
    const graph = buildGraph(parseFiles(files));

    const neighbors = computeNeighborhood(["mod-a"], graph, 2);
    // D→A is 1-hop in, already captured
    expect(neighbors.has("mod-d")).toBe(true);
  });

  it("seed IDs are not included in the result", () => {
    const files = makeChainFixture();
    const graph = buildGraph(parseFiles(files));

    const neighbors = computeNeighborhood(["mod-a"], graph, 2);
    expect(neighbors.has("mod-a")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Seed IDs not included
// ---------------------------------------------------------------------------

describe("computeNeighborhood — seed exclusion", () => {
  it("seed IDs are excluded even when they reference each other", () => {
    // A references B, B references A (mutual)
    const files = makeFiles([
      [
        "modules.md",
        [
          "## A {#mod-a}",
          "責務: A。参照: [[mod-b]]",
          "実装: src/a/",
          "",
          "## B {#mod-b}",
          "責務: B。参照: [[mod-a]]",
          "実装: src/b/",
        ].join("\n"),
      ],
    ]);
    const graph = buildGraph(parseFiles(files));

    const neighbors = computeNeighborhood(["mod-a", "mod-b"], graph, 2);
    // Both are seeds, so neither should appear in the result
    expect(neighbors.has("mod-a")).toBe(false);
    expect(neighbors.has("mod-b")).toBe(false);
    expect(neighbors.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Circular reference — no infinite loop
// ---------------------------------------------------------------------------

describe("computeNeighborhood — circular references", () => {
  it("handles a cycle (A→B→C→A) without infinite loop", () => {
    const files = makeFiles([
      [
        "modules.md",
        [
          "## A {#mod-a}",
          "責務: A。参照: [[mod-b]]",
          "実装: src/a/",
          "",
          "## B {#mod-b}",
          "責務: B。参照: [[mod-c]]",
          "実装: src/b/",
          "",
          "## C {#mod-c}",
          "責務: C。参照: [[mod-a]]",
          "実装: src/c/",
        ].join("\n"),
      ],
    ]);
    const graph = buildGraph(parseFiles(files));

    // Starting from mod-a; should not loop
    const neighbors = computeNeighborhood(["mod-a"], graph, 10);
    // mod-b and mod-c are reachable; mod-a (seed) is not in result
    expect(neighbors.has("mod-b")).toBe(true);
    expect(neighbors.has("mod-c")).toBe(true);
    expect(neighbors.has("mod-a")).toBe(false);
  });

  it("handles self-reference without looping", () => {
    const files = makeFiles([
      [
        "modules.md",
        [
          "## A {#mod-a}",
          "責務: A。自己参照: [[mod-a]]",
          "実装: src/a/",
        ].join("\n"),
      ],
    ]);
    const graph = buildGraph(parseFiles(files));

    const neighbors = computeNeighborhood(["mod-a"], graph, 5);
    // mod-a is seed, should not be added
    expect(neighbors.has("mod-a")).toBe(false);
    expect(neighbors.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Empty / edge cases
// ---------------------------------------------------------------------------

describe("computeNeighborhood — edge cases", () => {
  it("returns empty set for empty seedIds", () => {
    const files = makeChainFixture();
    const graph = buildGraph(parseFiles(files));

    const neighbors = computeNeighborhood([], graph, 2);
    expect(neighbors.size).toBe(0);
  });

  it("returns empty set when seedIds do not exist in graph", () => {
    const files = makeChainFixture();
    const graph = buildGraph(parseFiles(files));

    const neighbors = computeNeighborhood(["mod-nonexistent"], graph, 2);
    expect(neighbors.size).toBe(0);
  });

  it("returns empty set when maxHops is 0", () => {
    const files = makeChainFixture();
    const graph = buildGraph(parseFiles(files));

    const neighbors = computeNeighborhood(["mod-a"], graph, 0);
    expect(neighbors.size).toBe(0);
  });
});
