/**
 * Tests for src/state/effective.ts (T-03).
 *
 * Covers:
 *   - getEffectiveState: all degradation rule branches
 *   - computeEffectiveStates: effectiveMap and driftedIds
 */

import { describe, it, expect } from "bun:test";
import { getEffectiveState, computeEffectiveStates } from "./effective.ts";
import type { StateEntry, StateMap } from "./types.ts";

// ---------------------------------------------------------------------------
// getEffectiveState
// ---------------------------------------------------------------------------

describe("getEffectiveState — implemented + hash + match", () => {
  it("returns 'implemented' when hash matches", () => {
    const entry: StateEntry = { state: "implemented", request: "r1", hash: "abc" };
    expect(getEffectiveState(entry, "abc")).toBe("implemented");
  });
});

describe("getEffectiveState — implemented + hash + mismatch", () => {
  it("returns 'designed' when hash does not match (drift)", () => {
    const entry: StateEntry = { state: "implemented", request: "r1", hash: "abc" };
    expect(getEffectiveState(entry, "def")).toBe("designed");
  });
});

describe("getEffectiveState — implemented + no hash (backward compat)", () => {
  it("returns 'implemented' when entry has no hash field", () => {
    const entry: StateEntry = { state: "implemented", request: "r1" };
    expect(getEffectiveState(entry, "abc")).toBe("implemented");
  });

  it("returns 'implemented' even when currentHash is undefined", () => {
    const entry: StateEntry = { state: "implemented", request: "r1" };
    expect(getEffectiveState(entry, undefined)).toBe("implemented");
  });
});

describe("getEffectiveState — implemented + hash + currentHash undefined", () => {
  it("returns 'implemented' when element is not resolvable (fail-safe)", () => {
    const entry: StateEntry = { state: "implemented", request: "r1", hash: "abc" };
    expect(getEffectiveState(entry, undefined)).toBe("implemented");
  });
});

describe("getEffectiveState — non-implemented states", () => {
  it("returns 'requested' for requested entries (hash irrelevant)", () => {
    const entry: StateEntry = { state: "requested", request: "r1" };
    expect(getEffectiveState(entry, "any-hash")).toBe("requested");
    expect(getEffectiveState(entry, undefined)).toBe("requested");
  });

  it("returns 'designed' for designed entries (hash irrelevant)", () => {
    const entry: StateEntry = { state: "designed" };
    expect(getEffectiveState(entry, "any-hash")).toBe("designed");
    expect(getEffectiveState(entry, undefined)).toBe("designed");
  });
});

// ---------------------------------------------------------------------------
// computeEffectiveStates
// ---------------------------------------------------------------------------

describe("computeEffectiveStates — basic correctness", () => {
  it("returns effectiveMap with drifted entries showing state: designed", () => {
    const stateMap: StateMap = {
      "ent-order": { state: "implemented", request: "r1", hash: "aaa" },
      "ent-billing": { state: "implemented", request: "r2", hash: "bbb" },
    };
    const currentHashes = new Map([
      ["ent-order", "different-hash"], // drift
      ["ent-billing", "bbb"],          // match
    ]);

    const { effectiveMap, driftedIds } = computeEffectiveStates(stateMap, currentHashes);

    expect(effectiveMap["ent-order"]!.state).toBe("designed");
    expect(effectiveMap["ent-billing"]!.state).toBe("implemented");
    expect(driftedIds.has("ent-order")).toBe(true);
    expect(driftedIds.has("ent-billing")).toBe(false);
  });

  it("drifted entry preserves request, pr, hash fields", () => {
    const stateMap: StateMap = {
      "ent-order": { state: "implemented", request: "req1", pr: 5, hash: "old-hash" },
    };
    const currentHashes = new Map([["ent-order", "new-hash"]]);

    const { effectiveMap } = computeEffectiveStates(stateMap, currentHashes);
    const entry = effectiveMap["ent-order"]!;

    expect(entry.state).toBe("designed");
    expect(entry.request).toBe("req1");
    expect(entry.pr).toBe(5);
    expect(entry.hash).toBe("old-hash"); // original hash preserved
  });

  it("returns empty driftedIds when no entries drift", () => {
    const stateMap: StateMap = {
      "mod-cli": { state: "implemented", request: "r1", hash: "abc" },
      "mod-parse": { state: "requested", request: "r2" },
    };
    const currentHashes = new Map([["mod-cli", "abc"]]);

    const { driftedIds } = computeEffectiveStates(stateMap, currentHashes);
    expect(driftedIds.size).toBe(0);
  });

  it("does not mutate the original stateMap", () => {
    const stateMap: StateMap = {
      "ent-order": { state: "implemented", request: "r1", hash: "aaa" },
    };
    const currentHashes = new Map([["ent-order", "bbb"]]);

    computeEffectiveStates(stateMap, currentHashes);

    // Original must be unchanged
    expect(stateMap["ent-order"]!.state).toBe("implemented");
  });

  it("hash-less implemented entries are not drifted", () => {
    const stateMap: StateMap = {
      "mod-old": { state: "implemented", request: "r1" },
    };
    const currentHashes = new Map([["mod-old", "some-hash"]]);

    const { effectiveMap, driftedIds } = computeEffectiveStates(stateMap, currentHashes);
    expect(effectiveMap["mod-old"]!.state).toBe("implemented");
    expect(driftedIds.size).toBe(0);
  });
});
