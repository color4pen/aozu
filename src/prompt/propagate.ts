/**
 * Propagate instruction builder (mod-prompt).
 *
 * Assembles the instruction text that tells a consumer how to reflect an ADR
 * decision across all relevant design layers. The instruction is a pure function
 * of the inputs; the caller (mod-cli) handles all I/O.
 *
 * ADR-0008: `prompt propagate` is a prompt verb — writes nothing, outputs to stdout.
 * Injection scope follows ADR-0019 rules applied to an ADR as the starting point:
 *   - ADR body (id + topics frontmatter)
 *   - Seed elements (ADR [[id]] citations) + 2-hop neighborhood, body in full
 *   - inv / term: always full
 *   - static mod: heading + 責務: line only (condensed)
 *   - manifest enabled list
 *   - Format rules summary
 *   - Propagation guidance
 *
 * No loop gate: ADR is an always-layer type (C11). propagate succeeds regardless
 * of whether `loop` is in the manifest enabled list.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Guidance injected at the end of every propagate instruction.
 * Tells the consumer how to reflect the ADR decision across design layers.
 */
export const PROPAGATE_GUIDANCE = `\
Follow these steps to propagate the ADR decision across the design:

1. **Reflect the decision in all relevant design layers**: Read the ADR body above and identify which design elements in the corpus need to be updated or created to be consistent with this decision. Update each element's body so that it aligns with the decision.

2. **Run \`aozu check\` after each change**: After every modification, run \`aozu check\` to verify that all references resolve, IDs are valid, and closures are satisfied. Fix any check errors before proceeding to the next element.

3. **Cite changed elements with \`[[id]]\`**: When referencing a design element in your changes, use \`[[id]]\` notation. This declares coverage and is verified by \`aozu check\`.

4. **Completion condition**: Propagation is complete when \`aozu check\` exits with code 0 AND the decision described in the ADR is consistent across all affected design layers. Both conditions must hold.\
`;

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

/**
 * All inputs needed to build a propagate instruction text.
 */
export interface PropagateInput {
  /** ADR element ID (e.g. "adr-0019"). */
  adrId: string;
  /** ADR body text (frontmatter excluded). */
  adrBody: string;
  /** Seed element bodies: elements directly cited by [[id]] in the ADR body. */
  seedBodies: Map<string, string>;
  /** 2-hop neighborhood element bodies: reachable from seed elements within SCOPE_MAX_HOPS hops. */
  neighborBodies: Map<string, string>;
  /** Combined text of all term and inv elements (pre-formatted by caller). */
  termsAndInvariants: string;
  /** Condensed static module listing: heading + 責務: line only (pre-formatted by caller). */
  staticModulesSummary: string;
  /** List of enabled layer names from the manifest. */
  enabledLayers: string[];
  /** Format rules summary text. */
  formatRulesSummary: string;
  /** Propagation guidance text. */
  propagateGuidance: string;
}

// ---------------------------------------------------------------------------
// Builder (pure function)
// ---------------------------------------------------------------------------

/**
 * Build the propagate instruction text from the given inputs.
 *
 * Assembles 8 sections:
 *   1. ADR (id + body)
 *   2. Seed Element Bodies (direct [[id]] citations in the ADR)
 *   3. Neighborhood Element Bodies (2-hop from seeds)
 *   4. Terms and Invariants (always full)
 *   5. Static Modules (condensed: heading + 責務: line)
 *   6. Enabled Layers (from manifest)
 *   7. Format Rules (summary)
 *   8. Propagation Guidance (how to reflect the decision)
 *
 * Output is deterministic: same input → byte-identical output.
 * Map iteration order is determined by the caller (IDs must be sorted before passing).
 *
 * @param input  All materials needed to build the instruction.
 * @returns      Instruction text string (ready for stdout).
 */
export function buildPropagateInstruction(input: PropagateInput): string {
  const parts: string[] = [];

  parts.push("# ADR Propagation Instruction");
  parts.push("");

  // --- Section 1: ADR ---
  parts.push("## ADR");
  parts.push("");
  parts.push(`ADR ID: ${input.adrId}`);
  parts.push("");
  if (input.adrBody.trim() !== "") {
    parts.push(input.adrBody.trim());
  } else {
    parts.push("(no ADR body)");
  }
  parts.push("");

  // --- Section 2: Seed Element Bodies ---
  parts.push("## Seed Element Bodies");
  parts.push("");
  if (input.seedBodies.size === 0) {
    parts.push("(no seed elements — ADR has no [[id]] citations)");
    parts.push("");
  } else {
    for (const [id, body] of input.seedBodies) {
      parts.push(`### ${id}`);
      parts.push("");
      if (body.trim() !== "") {
        parts.push(body.trim());
      } else {
        parts.push("(body not available)");
      }
      parts.push("");
    }
  }

  // --- Section 3: Neighborhood Element Bodies (2-hop) ---
  parts.push("## Neighborhood Element Bodies (2-hop)");
  parts.push("");
  if (input.neighborBodies.size === 0) {
    parts.push("(no neighborhood elements)");
    parts.push("");
  } else {
    for (const [id, body] of input.neighborBodies) {
      parts.push(`### ${id}`);
      parts.push("");
      if (body.trim() !== "") {
        parts.push(body.trim());
      } else {
        parts.push("(body not available)");
      }
      parts.push("");
    }
  }

  // --- Section 4: Terms and Invariants ---
  parts.push("## Terms and Invariants");
  parts.push("");
  if (input.termsAndInvariants.trim() !== "") {
    parts.push(input.termsAndInvariants.trim());
  } else {
    parts.push("(no terms or invariants defined)");
  }
  parts.push("");

  // --- Section 5: Static Modules ---
  parts.push("## Static Modules");
  parts.push("");
  if (input.staticModulesSummary.trim() !== "") {
    parts.push(input.staticModulesSummary.trim());
  } else {
    parts.push("(no static modules defined)");
  }
  parts.push("");

  // --- Section 6: Enabled Layers ---
  parts.push("## Enabled Layers");
  parts.push("");
  if (input.enabledLayers.length > 0) {
    parts.push(input.enabledLayers.join(", "));
  } else {
    parts.push("(none)");
  }
  parts.push("");

  // --- Section 7: Format Rules ---
  parts.push("## Format Rules");
  parts.push("");
  parts.push(input.formatRulesSummary.trim());
  parts.push("");

  // --- Section 8: Propagation Guidance ---
  parts.push("## Propagation Guidance");
  parts.push("");
  parts.push(input.propagateGuidance.trim());
  parts.push("");

  return parts.join("\n");
}
