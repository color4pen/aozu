/**
 * Attribution helper: find the element that "owns" a given file/line position.
 *
 * Moved here from src/check/attribution.ts so that mod-plan and mod-prompt
 * can use it via mod-graph without creating a mod-plan -> mod-check dependency
 * (which is forbidden by design/static/dependencies.md).
 */

import type { Element } from "../parse/types.ts";

/**
 * Find the element that owns the given (file, line) position.
 *
 * Scans `elements` for entries where `el.file === file` and `el.line <= line`,
 * then returns the one with the greatest `el.line` (nearest preceding declaration).
 *
 * Returns `undefined` when no element in the given file precedes the line.
 */
export function findOwningElement(
  elements: Element[],
  file: string,
  line: number
): Element | undefined {
  let best: Element | undefined;

  for (const el of elements) {
    if (el.file !== file) continue;
    if (el.line > line) continue;
    if (best === undefined || el.line > best.line) {
      best = el;
    }
  }

  return best;
}
