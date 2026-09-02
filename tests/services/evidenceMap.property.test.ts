import { describe, expect, test } from "vitest";
import * as fc from "fast-check";
import {
  buildAxisBands,
  defaultExpandedKeys,
  restrictCellsToLeaves,
  visibleTreeCategories,
  type AxisTreeNode,
} from "@/services/evidenceMap";
import type { CrossFacetCell } from "@/types/models";

const pathArbitrary = fc.array(fc.integer({ min: 0, max: 2 }), {
  minLength: 1,
  maxLength: 4,
});

const treeArbitrary = fc
  .array(pathArbitrary, { minLength: 1, maxLength: 12 })
  .map(treeFromPaths);

const branchingTreeArbitrary = fc
  .array(pathArbitrary, { maxLength: 11 })
  .map((paths) => treeFromPaths([[0, 0], ...paths]));

function treeFromPaths(paths: readonly (readonly number[])[]): AxisTreeNode[] {
  const roots: AxisTreeNode[] = [];
  for (const path of paths) {
    let siblings = roots;
    const prefix: number[] = [];
    for (const segment of path) {
      prefix.push(segment);
      const key = `u:${prefix.join(".")}`;
      let node = siblings.find((candidate) => candidate.category.key === key);
      if (!node) {
        node = {
          category: { key, label: key },
          depth: prefix.length - 1,
          children: [],
        };
        siblings.push(node);
      }
      siblings = node.children;
    }
  }
  return roots;
}

function allNodes(tree: readonly AxisTreeNode[]): AxisTreeNode[] {
  const nodes: AxisTreeNode[] = [];
  const walk = (level: readonly AxisTreeNode[]) => {
    for (const node of level) {
      nodes.push(node);
      walk(node.children);
    }
  };
  walk(tree);
  return nodes;
}

function expansionStateArbitrary(treeArb = treeArbitrary) {
  return fc
    .tuple(
      treeArb,
      fc.array(fc.boolean(), { maxLength: 48 }),
      fc.boolean(),
    )
    .map(([tree, choices, includeUnknown]) => {
      const expandedKeys = new Set(
        allNodes(tree)
          .filter((_, index) => choices[index] ?? false)
          .map((node) => node.category.key),
      );
      if (includeUnknown) expandedKeys.add("u:unknown");
      return { tree, expandedKeys };
    });
}

describe("generated partially expanded axis layouts", () => {
  test("default expansion contains exactly the branching top concepts", () => {
    fc.assert(
      fc.property(treeArbitrary, (tree) => {
        expect([...defaultExpandedKeys(tree)]).toEqual(
          tree
            .filter((node) => node.children.length > 0)
            .map((node) => node.category.key),
        );
      }),
      { numRuns: 100 },
    );
  });

  test("visible categories, tiers, leaves, and rails stay aligned", () => {
    fc.assert(
      fc.property(
        expansionStateArbitrary(),
        ({ tree, expandedKeys }) => {
          const inputKeys = allNodes(tree).map((node) => node.category.key);
          const visible = visibleTreeCategories(tree, expandedKeys);
          const bands = buildAxisBands(tree, expandedKeys);
          const visibleKeys = visible.map((category) => category.key);
          const leafKeys = bands.leaves.map((leaf) => leaf.key);

          expect(new Set(visibleKeys).size).toBe(visibleKeys.length);
          expect(new Set(leafKeys).size).toBe(leafKeys.length);
          expect(visibleKeys.every((key) => inputKeys.includes(key))).toBe(true);
          expect(leafKeys.every((key) => inputKeys.includes(key))).toBe(true);
          expect(visibleKeys.map((key) => inputKeys.indexOf(key))).toEqual(
            [...visibleKeys]
              .map((key) => inputKeys.indexOf(key))
              .sort((a, b) => a - b),
          );
          expect(leafKeys).toEqual(
            visible
              .filter((category) => !category.expanded)
              .map((category) => category.key),
          );

          expect(bands.rail).toHaveLength(bands.leaves.length);
          bands.rail.forEach((rail, leafIndex) => {
            expect(rail.at(-1)?.key).toBe(bands.leaves[leafIndex].key);
            for (const cell of rail) {
              expect(cell.span).toBeGreaterThan(0);
              expect(cell.tierSpan).toBeGreaterThan(0);
              expect(leafIndex + cell.span).toBeLessThanOrEqual(
                bands.leaves.length,
              );
            }
          });
          expect(
            bands.tiers[0].reduce((sum, cell) => sum + cell.span, 0),
          ).toBe(bands.leaves.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("expanding a visible parent replaces only that terminal branch", () => {
    fc.assert(
      fc.property(
        expansionStateArbitrary(branchingTreeArbitrary),
        ({ tree, expandedKeys }) => {
          const candidate = tree.find((node) => node.children.length > 0)!;
          const collapsedKeys = new Set(expandedKeys);
          collapsedKeys.delete(candidate.category.key);
          const collapsed = buildAxisBands(tree, collapsedKeys);
          const candidateIndex = collapsed.leaves.findIndex(
            (leaf) => leaf.key === candidate.category.key,
          );

          const expandedKeysNext = new Set(collapsedKeys).add(
            candidate.category.key,
          );
          const expanded = buildAxisBands(tree, expandedKeysNext);
          const replacement = buildAxisBands(
            [candidate],
            expandedKeysNext,
          ).leaves;
          expect(candidateIndex).toBeGreaterThanOrEqual(0);
          expect(expanded.leaves).toEqual([
            ...collapsed.leaves.slice(0, candidateIndex),
            ...replacement,
            ...collapsed.leaves.slice(candidateIndex + 1),
          ]);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("collapse/re-expand round trips and unknown keys have no effect", () => {
    fc.assert(
      fc.property(
        expansionStateArbitrary(branchingTreeArbitrary),
        ({ tree, expandedKeys }) => {
          const candidate = tree.find((node) => node.children.length > 0)!;
          const originalKeys = new Set(expandedKeys).add(candidate.category.key);
          const original = buildAxisBands(tree, originalKeys);
          const collapsedKeys = new Set(originalKeys);
          collapsedKeys.delete(candidate.category.key);
          const collapsed = buildAxisBands(tree, collapsedKeys);
          const restoredKeys = new Set(collapsedKeys).add(candidate.category.key);

          expect(original.leaves.length).toBeGreaterThan(0);
          expect(collapsed.leaves.map((leaf) => leaf.key)).toContain(
            candidate.category.key,
          );
          expect(collapsed).not.toEqual(original);
          expect(buildAxisBands(tree, restoredKeys)).toEqual(original);
          expect(
            buildAxisBands(tree, new Set(originalKeys).add("u:not-in-tree")),
          ).toEqual(original);
        },
      ),
      { numRuns: 100 },
    );
  });
});

const cellArbitrary = fc
  .record({
    row: fc.integer({ min: 0, max: 5 }),
    column: fc.integer({ min: 0, max: 5 }),
    count: fc.integer({ min: 0, max: 10_000 }),
  })
  .map(
    ({ row, column, count }): CrossFacetCell => ({
      axes: [`r:${row}`, `c:${column}`],
      count,
    }),
  );

const allowedKeysArbitrary = (prefix: "r" | "c") =>
  fc
    .tuple(
      fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }),
      fc.boolean(),
    )
    .map(([choices, unrestricted]) =>
      unrestricted
        ? null
        : new Set(
            choices.flatMap((allowed, index) =>
              allowed ? [`${prefix}:${index}`] : [],
            ),
          ),
    );

describe("generated cell restriction", () => {
  test("preserves exactly the allowed cells, their order, and their counts", () => {
    fc.assert(
      fc.property(
        fc.array(cellArbitrary, { maxLength: 60 }),
        allowedKeysArbitrary("r"),
        allowedKeysArbitrary("c"),
        (cells, allowedRows, allowedColumns) => {
          const expected = cells.filter(
            ({ axes: [row, column] }) =>
              (!allowedRows || allowedRows.has(row)) &&
              (!allowedColumns || allowedColumns.has(column)),
          );
          const restricted = restrictCellsToLeaves(
            cells,
            allowedRows,
            allowedColumns,
          );
          expect(restricted).toEqual(expected);
          expect(
            restrictCellsToLeaves(restricted, allowedRows, allowedColumns),
          ).toEqual(restricted);
        },
      ),
      { numRuns: 100 },
    );
  });
});
