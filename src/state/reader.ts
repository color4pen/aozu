/**
 * State reader — reads state.json from disk.
 *
 * Returns the parsed StateMap, or an empty object if the file does not exist.
 * File I/O is isolated here so the rest of the codebase stays pure.
 */

import type { StateMap } from "./types.ts";

/**
 * Read state.json from `path`.
 *
 * - If the file exists: parse and return its contents as StateMap.
 * - If the file does not exist: return `{}` (all elements default to designed).
 */
export async function readState(path: string): Promise<StateMap> {
  const f = Bun.file(path);
  if (!(await f.exists())) {
    return {};
  }
  return (await f.json()) as StateMap;
}
