/**
 * Session instruction builder (mod-prompt).
 *
 * Assembles the instruction text that injects context for a design session
 * starting from a topic. The instruction is a pure function of the inputs;
 * the caller (mod-cli) handles all I/O (reading files, writing to stdout).
 *
 * ADR-0008: `prompt session` is a prompt verb — writes nothing, outputs to stdout.
 * Injection scope follows the rule in docs/open-questions.md §8 (initial version):
 *   - Topic body
 *   - Seed elements (topic's [[id]] citations) + 2-hop neighborhood, body in full
 *   - inv / term: always full
 *   - static mod: heading + 責務: line only (condensed)
 *   - manifest enabled list
 *   - Format rules summary
 *   - Session guidance
 */

// ---------------------------------------------------------------------------
// Constants (re-exported from shared.ts for backward compatibility)
// ---------------------------------------------------------------------------

// SESSION_MAX_HOPS and FORMAT_RULES_SUMMARY have been moved to shared.ts
// (renamed to SCOPE_MAX_HOPS) so propagate and review can share them.
// Re-export here under the original names so existing imports are not broken.
export { SCOPE_MAX_HOPS as SESSION_MAX_HOPS, FORMAT_RULES_SUMMARY } from "./shared.ts";

/**
 * Session guidance injected at the end of every session instruction.
 * Tells the agent how to conduct the design session.
 */
export const SESSION_GUIDANCE = `\
Follow these conventions for the design session:

1. **Create new elements with scaffold**: Use \`aozu scaffold <prefix> <slug>\` to create new design elements with the correct file structure and frontmatter.

2. **Run check while editing**: Run \`aozu check\` frequently to verify that all references resolve, IDs are valid, and closures are satisfied. Fix check errors before proceeding.

3. **Record decisions in ADRs**: When a significant design decision is made, record it as an ADR using \`aozu scaffold adr <slug>\`. ADRs capture the decision, alternatives considered, and rationale.

4. **Address topics via ADR citation**: A topic is considered addressed when an ADR's frontmatter references it via the \`topics:\` key (ADR-0018). Example:
   \`\`\`
   ---
   id: adr-0042
   topics: [[top-my-topic]]
   ---
   \`\`\`\
`;

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

/**
 * All inputs needed to build a session instruction text.
 */
export interface SessionInput {
  /** Topic element ID (e.g. "top-my-topic"). */
  topicId: string;
  /** Topic body text (frontmatter excluded; source information should appear in the body). */
  topicBody: string;
  /** Seed element bodies: elements directly cited by [[id]] in the topic body. */
  seedBodies: Map<string, string>;
  /** 2-hop neighborhood element bodies: reachable from seed elements within SESSION_MAX_HOPS hops. */
  neighborBodies: Map<string, string>;
  /** Combined text of all term and inv elements (pre-formatted by caller). */
  termsAndInvariants: string;
  /** Condensed static module listing: heading + 責務: line only (pre-formatted by caller). */
  staticModulesSummary: string;
  /** List of enabled layer names from the manifest. */
  enabledLayers: string[];
  /** Format rules summary text. */
  formatRulesSummary: string;
  /** Session guidance text. */
  sessionGuidance: string;
}

// ---------------------------------------------------------------------------
// Builder (pure function)
// ---------------------------------------------------------------------------

/**
 * Build the session instruction text from the given inputs.
 *
 * Assembles 8 sections:
 *   1. Topic (id + body)
 *   2. Seed Element Bodies (direct [[id]] citations in the topic)
 *   3. Neighborhood Element Bodies (2-hop from seeds)
 *   4. Terms and Invariants (always full)
 *   5. Static Modules (condensed: heading + 責務: line)
 *   6. Enabled Layers (from manifest)
 *   7. Format Rules (summary of declaration / reference / ID / type / frontmatter rules)
 *   8. Session Guidance (how to conduct the session)
 *
 * Output is deterministic: same input → byte-identical output.
 *
 * @param input  All materials needed to build the instruction.
 * @returns      Instruction text string (ready for stdout).
 */
export function buildSessionInstruction(input: SessionInput): string {
  const parts: string[] = [];

  parts.push("# Design Session Instruction");
  parts.push("");

  // --- Section 1: Topic ---
  parts.push("## Topic");
  parts.push("");
  parts.push(`Topic ID: ${input.topicId}`);
  parts.push("");
  if (input.topicBody.trim() !== "") {
    parts.push(input.topicBody.trim());
  } else {
    parts.push("(no topic body)");
  }
  parts.push("");

  // --- Section 2: Seed Element Bodies ---
  parts.push("## Seed Element Bodies");
  parts.push("");
  if (input.seedBodies.size === 0) {
    parts.push("(no seed elements — topic has no [[id]] citations)");
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

  // --- Section 8: Session Guidance ---
  parts.push("## Session Guidance");
  parts.push("");
  parts.push(input.sessionGuidance.trim());
  parts.push("");

  return parts.join("\n");
}
