/**
 * Type definitions for the state module.
 *
 * `state.json` stores the implementation state of design elements.
 * The state module provides read-only access (write side is out of scope).
 */

/** A single state entry for a design element. */
export interface StateEntry {
  state: "designed" | "requested" | "implemented";
  request?: string;
  pr?: number;
  /**
   * SHA-256 hex of the element's body range at mark-implemented time.
   * Absent for entries created before this feature, or for elements whose
   * body could not be resolved. Used by check / status / coverage to detect
   * body drift (designed-reversion mechanism, ADR-0018 補記).
   */
  hash?: string;
}

/** Map from element ID to its state entry. */
export type StateMap = Record<string, StateEntry>;
