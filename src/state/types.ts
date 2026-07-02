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
}

/** Map from element ID to its state entry. */
export type StateMap = Record<string, StateEntry>;
