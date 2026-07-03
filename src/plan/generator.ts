/**
 * Plan document generator (mod-plan).
 *
 * Generates a `plans/<slug>.md` document (spec/format.md §8 — plan schema)
 * from a list of designed elements and annotation materials.
 *
 * This is a pure function: no file I/O. The caller handles reading/writing.
 *
 * ADR-0018: plan is a present-tense working document. No `request:` lines.
 * ADR-0006: annotations are free-Markdown nodes that provide ordering / parallel
 *           conflict material for the human editor.
 */

// ---------------------------------------------------------------------------
// Annotation input type
// ---------------------------------------------------------------------------

/**
 * Annotation materials derived from the reference graph and state.
 * Passed to generatePlan and embedded as a free-Markdown section.
 */
export interface PlanAnnotations {
  /** Reference edges between designed elements (ordering constraint material). */
  referenceEdges: Array<{ from: string; to: string }>;
  /** Module affiliation for each element (parallel conflict material). */
  modGrounding: Map<string, string[]>;
  /** Elements currently in "requested" state (in-flight duplicate material). */
  requestedElements: Array<{ id: string; request: string }>;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a plan Markdown document conforming to spec/format.md §8.
 *
 * @param slug        Plan slug (used for `id: plan-<slug>` and `{#grp-<slug>}`).
 * @param designed    List of designed element IDs to include in the initial group.
 * @param annotations Annotation materials from the reference graph and state.
 * @returns           Complete Markdown string for the plan file.
 */
export function generatePlan(
  slug: string,
  designed: string[],
  annotations: PlanAnnotations
): string {
  const lines: string[] = [];

  // --- Frontmatter ---
  lines.push("---");
  lines.push(`id: plan-${slug}`);
  lines.push("status: open");
  lines.push("---");

  // --- H1 title (spec §5: display name is the first # heading) ---
  lines.push(`# ${slug}`);
  lines.push("");

  // --- Single initial group ---
  lines.push(`## グループ {#grp-${slug}}`);
  const elemRefs = designed.map((id) => `[[${id}]]`).join(", ");
  lines.push(`- elements: ${elemRefs}`);
  lines.push("- parallel: no");
  lines.push("");

  // --- Annotation section ---
  lines.push("## 注釈");
  lines.push("");
  lines.push("<!-- 以下は参照グラフと state.json から決定的に導出した注釈です。人が編集する際の判断材料として参照してください。 -->");
  lines.push("");

  // (a) Reference edges between designed elements (ordering constraints)
  lines.push("### 参照辺（順序制約の材料）");
  lines.push("");
  if (annotations.referenceEdges.length === 0) {
    lines.push("（設計済み要素間の参照なし）");
  } else {
    for (const edge of annotations.referenceEdges) {
      lines.push(`- [[${edge.from}]] → [[${edge.to}]]`);
    }
  }
  lines.push("");

  // (b) Module grounding (parallel conflict material)
  lines.push("### モジュール接地（並列衝突の材料）");
  lines.push("");
  const groundingEntries = [...annotations.modGrounding.entries()].filter(
    ([, mods]) => mods.length > 0
  );
  if (groundingEntries.length === 0) {
    lines.push("（モジュール接地なし）");
  } else {
    for (const [elementId, mods] of groundingEntries) {
      const modList = mods.map((m) => `[[${m}]]`).join(", ");
      lines.push(`- [[${elementId}]]: ${modList}`);
    }
  }
  lines.push("");

  // (c) Currently requested elements (in-flight duplicates)
  lines.push("### 実行中の要素（in-flight 重複の材料）");
  lines.push("");
  if (annotations.requestedElements.length === 0) {
    lines.push("（実行中の要素なし）");
  } else {
    for (const { id, request } of annotations.requestedElements) {
      lines.push(`- [[${id}]] (request: ${request})`);
    }
  }
  lines.push("");

  return lines.join("\n");
}
