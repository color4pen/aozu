/**
 * Derive instruction builder (mod-prompt).
 *
 * Assembles the instruction text that tells a code-generating agent what to
 * implement. The instruction is a pure function of the inputs; the caller
 * (mod-cli) handles all I/O (reading files, executing the template command,
 * writing to stdout).
 *
 * ADR-0012: consumers are not hard-coded. Template and output path are injected
 * by the caller from manifest frontmatter.
 * ADR-0008: `prompt derive` is a prompt verb — writes nothing, outputs to stdout.
 */

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

/**
 * All inputs needed to build a derive instruction text.
 */
export interface DeriveInput {
  /** ID of the group being derived. */
  groupId: string;
  /** Element IDs in the group. */
  groupElements: string[];
  /** Body texts of group elements, keyed by element ID. */
  elementBodies: Map<string, string>;
  /** Body texts of 2-hop neighborhood elements, keyed by element ID. */
  neighborBodies: Map<string, string>;
  /** Combined text of all term and inv elements. */
  termsAndInvariants: string;
  /** Template content (from file or command stdout). */
  templateContent: string;
  /** Output directory path for the generated request draft. */
  outputDir: string;
}

// ---------------------------------------------------------------------------
// Builder (pure function)
// ---------------------------------------------------------------------------

const TEMPLATE_BEGIN = "---TEMPLATE BEGIN---";
const TEMPLATE_END = "---TEMPLATE END---";

/**
 * Build the derive instruction text from the given inputs.
 *
 * The instruction assembles 6 sections:
 *   1. Template (delimited by TEMPLATE BEGIN/END markers)
 *   2. Target element bodies
 *   3. Neighborhood element bodies (2-hop)
 *   4. Terms and invariants
 *   5. Citation convention
 *   6. Output path
 *
 * @param input  All materials needed to build the instruction.
 * @returns      Instruction text string (ready for stdout).
 */
export function buildDeriveInstruction(input: DeriveInput): string {
  const parts: string[] = [];

  parts.push("# Request Draft Generation Instruction");
  parts.push("");
  parts.push(`Group: ${input.groupId}`);
  parts.push(`Target elements: ${input.groupElements.join(", ")}`);
  parts.push("");

  // --- Section 1: Template ---
  parts.push("## Request Template");
  parts.push("");
  parts.push(TEMPLATE_BEGIN);
  parts.push(input.templateContent);
  parts.push(TEMPLATE_END);
  parts.push("");

  // --- Section 2: Target element bodies ---
  parts.push("## Target Element Bodies");
  parts.push("");
  parts.push(
    "The following are the full bodies of the design elements to be implemented."
  );
  parts.push("Use `[[id]]` citations in the request body to declare coverage.");
  parts.push("");
  for (const id of input.groupElements) {
    const body = input.elementBodies.get(id);
    parts.push(`### ${id}`);
    parts.push("");
    if (body !== undefined && body.trim() !== "") {
      parts.push(body.trim());
    } else {
      parts.push("(body not available)");
    }
    parts.push("");
  }

  // --- Section 3: Neighborhood element bodies (2-hop) ---
  parts.push("## Neighborhood Element Bodies (2-hop)");
  parts.push("");
  parts.push(
    "The following elements are within 2 hops of the target elements in the reference graph."
  );
  parts.push(
    "They provide context about constraints and interfaces that the implementation must respect."
  );
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

  // --- Section 4: Terms and invariants ---
  parts.push("## Terms and Invariants");
  parts.push("");
  if (input.termsAndInvariants.trim() !== "") {
    parts.push(input.termsAndInvariants.trim());
  } else {
    parts.push("(no terms or invariants defined)");
  }
  parts.push("");

  // --- Section 5: Citation convention ---
  parts.push("## Citation Convention");
  parts.push("");
  parts.push(
    "変更対象の設計要素を `[[id]]` で本文に引用せよ。引用は被覆の宣言であり coverage が検証する。"
  );
  parts.push("");
  parts.push(
    "Cite changed design elements as `[[id]]` in the request body. Citations are coverage declarations verified by `aozu check --request`."
  );
  parts.push("");

  // --- Section 6: Output path ---
  parts.push("## Output Path");
  parts.push("");
  parts.push(`Write the generated request draft to: ${input.outputDir}`);
  parts.push("");

  return parts.join("\n");
}
