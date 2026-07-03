/**
 * Attribution helper: find the element that "owns" a given file/line position.
 *
 * The owning element is the element declared in the same file whose declaration
 * line is the largest line number ≤ the given line (i.e. the nearest heading
 * element that precedes the reference in document order).
 *
 * Implementation has been moved to src/graph/attribution.ts so that mod-plan
 * and mod-prompt can use it without depending on mod-check.
 * This file re-exports for backward compatibility of existing mod-check consumers.
 */

export { findOwningElement } from "../graph/attribution.ts";
