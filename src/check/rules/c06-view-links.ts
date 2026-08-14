/**
 * C6: View type link obligations (two-phase dispatch).
 *
 * spec/format.md §10 C6: ビューのリンク義務が充足される
 *
 * Two-phase structure (ADR-0022-3):
 * - Phase 1 (supported): dispatch to type-specific schema validation.
 *   Currently only "permission" is supported.
 * - Phase 2 (unsupported): fail-closed — any unsupported view type in
 *   `enabled` produces a C6 error diagnostic.
 *
 * Future view types: add to SUPPORTED_VIEW_TYPES in manifest.ts and add
 * a validator branch here.
 */

import type { Manifest, Graph } from "../../graph/types.ts";
import type { CheckDiagnostic } from "../types.ts";
import { VIEW_TYPE_NAMES, SUPPORTED_VIEW_TYPES } from "../manifest.ts";
import { findOwningElement } from "../../graph/attribution.ts";
import { extractPrefix } from "../../graph/index.ts";

/**
 * Check C6: Two-phase view type validation.
 *
 * For each view type name in `manifest.enabled`:
 * - If supported: dispatch to schema-specific validation.
 * - If unsupported: produce a C6 error (fail-closed).
 */
export function checkC6(manifest: Manifest, graph: Graph): CheckDiagnostic[] {
  const diagnostics: CheckDiagnostic[] = [];

  for (const name of manifest.enabled) {
    if (!VIEW_TYPE_NAMES.has(name)) continue;

    if (SUPPORTED_VIEW_TYPES.has(name)) {
      // Supported view type: dispatch to type-specific validation
      if (name === "permission") {
        diagnostics.push(...checkPermission(graph));
      }
    } else {
      // Unsupported view type: fail-closed
      diagnostics.push({
        level: "error",
        code: "C6",
        elementId: null,
        message: `unsupported view type: "${name}" (view type schemas are not yet defined)`,
        file: "",
        line: 0,
      });
    }
  }

  return diagnostics;
}

/**
 * Validate perm elements when permission view is enabled.
 *
 * Checks per perm element:
 * (a) Malformed operation lines: `- <token>: [[...]]` where token is not `[[op-id]]`.
 * (b) Non-empty: at least one valid operation line must exist.
 * (c) Op reference: operation field must resolve to an existing op element.
 * (d) Op prefix: operation element must have prefix "op".
 * (e) Unique: op references must be unique within a perm element.
 * (f) Act prefix: all actor references must have the "act" prefix.
 * (g) Perm target single-reference: `対象:` lines on perms must have exactly one reference.
 *
 * Reference resolution (whether act elements actually exist) is C3's
 * responsibility — matching C5's division of labour.
 */
function checkPermission(graph: Graph): CheckDiagnostic[] {
  const diagnostics: CheckDiagnostic[] = [];

  // Collect all perm elements
  const permElements = graph.rawElements.filter((el) => el.prefix === "perm");

  // Group valid operation lines by owning perm element
  const opsByPermId = new Map<string, typeof graph.permOperations[number][]>();
  for (const el of permElements) {
    opsByPermId.set(el.id, []);
  }
  for (const op of graph.permOperations) {
    const owner = findOwningElement(graph.rawElements, op.file, op.line);
    if (owner && owner.prefix === "perm" && opsByPermId.has(owner.id)) {
      opsByPermId.get(owner.id)!.push(op);
    }
  }

  // Group malformed operation lines by owning perm element
  const malformedByPermId = new Map<string, typeof graph.malformedPermOperations[number][]>();
  for (const el of permElements) {
    malformedByPermId.set(el.id, []);
  }
  for (const m of graph.malformedPermOperations) {
    const owner = findOwningElement(graph.rawElements, m.file, m.line);
    if (owner && owner.prefix === "perm" && malformedByPermId.has(owner.id)) {
      malformedByPermId.get(owner.id)!.push(m);
    }
  }

  // Validate each perm element
  for (const permEl of permElements) {
    // (a) Malformed operation lines
    for (const m of malformedByPermId.get(permEl.id) ?? []) {
      diagnostics.push({
        level: "error",
        code: "C6",
        elementId: permEl.id,
        message: `perm element "${permEl.id}" has malformed operation line at line ${m.line}: expected "- [[op-id]]: [[act-id]]..." format`,
        file: m.file,
        line: m.line,
      });
    }

    const ops = opsByPermId.get(permEl.id) ?? [];

    // (b) Non-empty obligation (valid ops only; malformed don't count)
    if (ops.length === 0) {
      diagnostics.push({
        level: "error",
        code: "C6",
        elementId: permEl.id,
        message: `perm element "${permEl.id}" has no operation lines (non-empty obligation)`,
        file: permEl.file,
        line: permEl.line,
      });
      // skip per-op checks since there are no valid ops
      continue;
    }

    // (c)-(f) Per-operation checks
    const seenOps = new Set<string>();
    for (const op of ops) {
      // (c) Op reference resolution
      const opEl = graph.elements.get(op.operation);
      if (!opEl) {
        diagnostics.push({
          level: "error",
          code: "C6",
          elementId: permEl.id,
          message: `perm element "${permEl.id}" operation line references unresolved op "${op.operation}"`,
          file: op.file,
          line: op.line,
        });
        // Still check actor prefixes below
      } else if (extractPrefix(op.operation) !== "op") {
        // (d) Op prefix check
        diagnostics.push({
          level: "error",
          code: "C6",
          elementId: permEl.id,
          message: `perm element "${permEl.id}" operation reference "${op.operation}" is not an op element (prefix: "${extractPrefix(op.operation)}")`,
          file: op.file,
          line: op.line,
        });
        // Still check actor prefixes below
      } else {
        // (e) Uniqueness (only for valid op references)
        if (seenOps.has(op.operation)) {
          diagnostics.push({
            level: "error",
            code: "C6",
            elementId: permEl.id,
            message: `perm element "${permEl.id}" has duplicate operation "${op.operation}"`,
            file: op.file,
            line: op.line,
          });
        } else {
          seenOps.add(op.operation);
        }
      }

      // (f) Actor reference prefix must be "act"
      for (const actorId of op.actorIds) {
        const prefix = extractPrefix(actorId);
        if (prefix !== "act") {
          diagnostics.push({
            level: "error",
            code: "C6",
            elementId: permEl.id,
            message: `perm element "${permEl.id}" operation "${op.operation}" references "${actorId}" which is not an act element (prefix: "${prefix}")`,
            file: op.file,
            line: op.line,
          });
        }
      }
    }
  }

  // (g) Perm target single-reference constraint
  for (const tl of graph.targetLines) {
    if (tl.targetIds.length <= 1) continue;
    const owner = findOwningElement(graph.rawElements, tl.file, tl.line);
    if (!owner || owner.prefix !== "perm") continue;
    diagnostics.push({
      level: "error",
      code: "C6",
      elementId: owner.id,
      message: `perm element "${owner.id}" target line at line ${tl.line} must contain exactly one reference (found ${tl.targetIds.length})`,
      file: tl.file,
      line: tl.line,
    });
  }

  return diagnostics;
}
