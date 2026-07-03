/**
 * State writer — writes state.json to disk.
 *
 * Encapsulates the state file name and wire format so that callers outside
 * mod-state never spell out the file location or serialisation format
 * (inv-tool-writes-state: the state file is mod-state's exclusive knowledge).
 *
 * Format (spec/format.md §9):
 *   - Keys in lexicographic order (Object.keys(stateMap).sort())
 *   - One entry per line: `  "<key>": <JSON(value)>`
 *   - Empty stateMap: write `{}` (single line) only when the file already
 *     exists; if the file does not exist, do NOT create it (all elements
 *     default to "designed" without a state.json present)
 */

import type { StateMap } from "./types.ts";

/**
 * Write the state map for a design directory.
 *
 * Encapsulates the state file name so callers outside mod-state never spell
 * out the file location (inv-tool-writes-state).
 *
 * @param designDir  Path to the design directory (e.g. `./design`).
 * @param stateMap   State map to write.
 */
export async function writeDesignState(
  designDir: string,
  stateMap: StateMap
): Promise<void> {
  const path = `${designDir}/state.json`;
  const keys = Object.keys(stateMap).sort();

  if (keys.length === 0) {
    // Do not create the file if it does not exist (empty == all designed)
    const f = Bun.file(path);
    if (!(await f.exists())) {
      return;
    }
    // Overwrite existing file with minimal empty JSON
    await Bun.write(path, "{}\n");
    return;
  }

  // Build 1-element-per-line JSON manually (spec §9: "1 要素 1 行")
  // Using manual construction instead of JSON.stringify(_, _, 2) because
  // the built-in indentation also indents inside value objects, producing
  // multi-line entries.
  const lines: string[] = ["{"];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const value = stateMap[key]!;
    const comma = i < keys.length - 1 ? "," : "";
    lines.push(`  "${key}": ${JSON.stringify(value)}${comma}`);
  }
  lines.push("}");

  await Bun.write(path, lines.join("\n") + "\n");
}
