/**
 * Attribution helper: find the element that "owns" a given file/line position.
 *
 * The owning element is the element declared in the same file whose declaration
 * line is the largest line number ≤ the given line (i.e. the nearest heading
 * element that precedes the reference in document order).
 */

import type { Element } from "../graph/index.ts";

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
