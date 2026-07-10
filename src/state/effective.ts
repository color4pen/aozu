/**
 * Effective state computation for the designed-reversion mechanism (ADR-0018 補記).
 *
 * An `implemented` element whose recorded `hash` does not match the current
 * body hash is treated as `designed` (縮退 / degradation).  This is a pure
 * calculation — `state.json` is never modified.  The actual state on disk
 * remains `implemented`; only the in-memory view used by check / status /
 * coverage reflects the degradation.
 *
 * Degradation rules (getEffectiveState):
 *   - state !== "implemented"              → state as-is (only implemented can degrade)
 *   - entry.hash === undefined             → "implemented" (pre-existing entry; backward-compat)
 *   - currentHash === undefined            → "implemented" (element not resolvable; fail-safe)
 *   - entry.hash === currentHash           → "implemented" (no drift)
 *   - entry.hash !== currentHash           → "designed"   (drift detected)
 */

import type { StateEntry, StateMap } from "./types.ts";

// ---------------------------------------------------------------------------
// getEffectiveState
// ---------------------------------------------------------------------------

/**
 * Compute the effective state of a single element.
 *
 * @param entry        The raw state entry from state.json.
 * @param currentHash  The current SHA-256 hex of the element's body range,
 *                     or `undefined` if the element could not be resolved from
 *                     the design files (deleted element, missing file, etc.).
 * @returns            The effective state: either the entry's state unchanged,
 *                     or `"designed"` when drift is detected.
 */
export function getEffectiveState(
  entry: StateEntry,
  currentHash: string | undefined
): "designed" | "requested" | "implemented" {
  if (entry.state !== "implemented") {
    // Only implemented entries can degrade
    return entry.state;
  }

  if (entry.hash === undefined) {
    // No hash recorded (entry predates this feature) → no degradation
    return "implemented";
  }

  if (currentHash === undefined) {
    // Element cannot be resolved from design files (deleted element residue, etc.)
    // → fail-safe: do not degrade; C8 will report the stale entry separately
    return "implemented";
  }

  if (entry.hash === currentHash) {
    // Hash matches → no drift
    return "implemented";
  }

  // Hash mismatch → drift detected → degrade to designed
  return "designed";
}

// ---------------------------------------------------------------------------
// computeEffectiveStates
// ---------------------------------------------------------------------------

/**
 * Compute effective states for the entire state map.
 *
 * Applies `getEffectiveState` to every entry.  Entries whose effective state
 * differs from the raw state are copied with `state` overridden to `"designed"`;
 * the original `stateMap` is never mutated.
 *
 * @param stateMap      Raw state map from state.json.
 * @param currentHashes Map from element ID to current body hash (from computeAllHashes).
 * @returns             `effectiveMap`: a new StateMap with drifted entries showing
 *                      `state: "designed"` (all other fields preserved).
 *                      `driftedIds`: the set of element IDs whose effective state
 *                      differs from the raw state.
 *
 * Note: effectiveMap is a readonly view — callers must not write it back to disk.
 * State-writing is the exclusive responsibility of mark and coverage.
 */
export function computeEffectiveStates(
  stateMap: StateMap,
  currentHashes: Readonly<Map<string, string>>
): { effectiveMap: Readonly<StateMap>; driftedIds: ReadonlySet<string> } {
  const effectiveMap: StateMap = {};
  const driftedIds = new Set<string>();

  for (const [id, entry] of Object.entries(stateMap)) {
    const currentHash = currentHashes.get(id);
    const effective = getEffectiveState(entry, currentHash);

    if (effective !== entry.state) {
      // Drift detected: create a new entry with state overridden; preserve all other fields
      driftedIds.add(id);
      effectiveMap[id] = { ...entry, state: effective };
    } else {
      effectiveMap[id] = entry;
    }
  }

  return { effectiveMap, driftedIds };
}
