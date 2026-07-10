/**
 * Public API for the state module.
 */

export type { StateEntry, StateMap } from "./types.ts";
export { readState, readDesignState } from "./reader.ts";
export { writeDesignState, serializeEntry } from "./writer.ts";
export { getEffectiveState, computeEffectiveStates } from "./effective.ts";
