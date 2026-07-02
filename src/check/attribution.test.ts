import { describe, expect, it } from "bun:test";
import { findOwningElement } from "./attribution.ts";
import type { Element } from "../graph/index.ts";

function el(id: string, file: string, line: number): Element {
  return { id, prefix: id.split("-")[0]!, displayName: id, file, line };
}

describe("findOwningElement", () => {
  it("single element in file → returns that element", () => {
    const elements: Element[] = [el("mod-a", "modules.md", 1)];
    expect(findOwningElement(elements, "modules.md", 5)?.id).toBe("mod-a");
  });

  it("two elements, reference in second section → returns second element", () => {
    const elements: Element[] = [
      el("act-sales", "actors.md", 1),
      el("act-bad", "actors.md", 10),
    ];
    // line 15 is after act-bad's declaration on line 10
    expect(findOwningElement(elements, "actors.md", 15)?.id).toBe("act-bad");
  });

  it("two elements, reference in first section (before second declaration) → returns first element", () => {
    const elements: Element[] = [
      el("act-sales", "actors.md", 1),
      el("act-bad", "actors.md", 10),
    ];
    // line 5 is before act-bad's declaration on line 10
    expect(findOwningElement(elements, "actors.md", 5)?.id).toBe("act-sales");
  });

  it("reference before first element declaration → returns undefined", () => {
    const elements: Element[] = [el("mod-a", "modules.md", 5)];
    // line 3 is before mod-a's declaration on line 5
    expect(findOwningElement(elements, "modules.md", 3)).toBeUndefined();
  });

  it("reference file not present in elements → returns undefined", () => {
    const elements: Element[] = [el("mod-a", "modules.md", 1)];
    expect(findOwningElement(elements, "actors.md", 5)).toBeUndefined();
  });

  it("multiple files mixed in elements → only considers elements from the correct file", () => {
    const elements: Element[] = [
      el("mod-a", "modules.md", 1),
      el("act-sales", "actors.md", 1),
      el("act-bad", "actors.md", 10),
    ];
    // Asking for actors.md line 15: should not pick mod-a from modules.md
    expect(findOwningElement(elements, "actors.md", 15)?.id).toBe("act-bad");
    // Asking for modules.md line 3: should not pick act-sales from actors.md
    expect(findOwningElement(elements, "modules.md", 3)?.id).toBe("mod-a");
  });
});
