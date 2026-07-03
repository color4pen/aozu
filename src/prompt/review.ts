/**
 * Review instruction builder (mod-prompt).
 *
 * Assembles the instruction text that asks a consumer to review the full design
 * corpus for semantic contradictions and inconsistencies. The instruction is a
 * pure function of the inputs; the caller (mod-cli) handles all I/O.
 *
 * ADR-0008: `prompt review` is a prompt verb — writes nothing, outputs to stdout.
 * Injection scope (D3, initial version):
 *   - All element bodies (ID lexicographic order)
 *   - Format rules summary
 *   - Findings format guidance (verdict is the human's, check's C1-C11 excluded)
 *
 * No loop gate: review targets the whole corpus, not a loop-layer element type.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Guidance injected at the end of every review instruction.
 *
 * Specifies the findings format, scope boundaries, and verdict ownership.
 * Explicitly excludes structural violations already covered by `aozu check`
 * (C1-C11) to separate deterministic validation from semantic review.
 */
export const REVIEW_GUIDANCE = `\
Review the design elements listed above and identify any semantic contradictions, inconsistencies, or misalignments. Follow these instructions:

1. **Findings format**: One finding per line. Each line must follow this format:
   \`<element-id1>[, <element-id2>, ...] — <description of contradiction or inconsistency>\`
   List all element IDs involved in the contradiction, separated by commas.

2. **Scope**: Focus on semantic and logical contradictions — cases where the meaning or intent of elements conflict with each other. Examples: an invariant that contradicts an entity's stated behaviour; a module whose 責務 overlaps with another module's 責務; a term definition that is inconsistent with how it is used in other elements.

3. **Excluded from scope (check's domain)**: Do NOT include findings about structural violations already detected deterministically by \`aozu check\`:
   - Broken references (unresolved [[id]] citations) — C3
   - Duplicate IDs — C2
   - Link obligation failures (missing required references) — C4, C5, C6, C10
   - ID grammar violations — C1
   - Manifest prerequisites — C7
   - State key violations — C8
   - ADR topics constraints — C9
   - Layer direction violations — C11
   These are the domain of \`aozu check\` (C1-C11) and must not appear in your findings.

4. **Verdict**: You MUST NOT render a verdict (accept / reject / approve / disapprove) on the design. Verdict is the human reviewer's responsibility. Your role is to enumerate findings only.\
`;

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

/**
 * All inputs needed to build a review instruction text.
 */
export interface ReviewInput {
  /** All element bodies, keyed by element ID (caller must sort by ID before passing). */
  allBodies: Map<string, string>;
  /** Format rules summary text. */
  formatRulesSummary: string;
  /** Review guidance text. */
  reviewGuidance: string;
}

// ---------------------------------------------------------------------------
// Builder (pure function)
// ---------------------------------------------------------------------------

/**
 * Build the review instruction text from the given inputs.
 *
 * Assembles 3 sections:
 *   1. All Element Bodies (ID lexicographic order — caller's responsibility)
 *   2. Format Rules (summary)
 *   3. Review Guidance (findings format, scope, verdict ownership)
 *
 * Output is deterministic: same input → byte-identical output.
 * Map iteration order is determined by the caller (IDs must be sorted before passing).
 *
 * @param input  All materials needed to build the instruction.
 * @returns      Instruction text string (ready for stdout).
 */
export function buildReviewInstruction(input: ReviewInput): string {
  const parts: string[] = [];

  parts.push("# Design Corpus Review Instruction");
  parts.push("");

  // --- Section 1: All Element Bodies ---
  parts.push("## All Element Bodies");
  parts.push("");
  if (input.allBodies.size === 0) {
    parts.push("(no elements defined)");
    parts.push("");
  } else {
    for (const [id, body] of input.allBodies) {
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

  // --- Section 2: Format Rules ---
  parts.push("## Format Rules");
  parts.push("");
  parts.push(input.formatRulesSummary.trim());
  parts.push("");

  // --- Section 3: Review Guidance ---
  parts.push("## Review Guidance");
  parts.push("");
  parts.push(input.reviewGuidance.trim());
  parts.push("");

  return parts.join("\n");
}
