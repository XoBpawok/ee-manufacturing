# Persisted Prices, Accordions & Capital Component Cost Reduction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist custom material prices, collapse large UI sections into accordions, and add a per-build "% off" reduction of Capital Component job cost.

**Architecture:** Three independent slices. (1) Domain change in `tree.ts` adds a cost-reduction factor applied to job cost of nodes whose `type` is the Capital Component type — tested via vitest. (2) Store (`useCalculator.ts`) persists `priceOverrides` and the new reduction to `localStorage`, restores on load, and stops clearing prices on item switch. (3) UI: a numeric input in `SkillsPanel`, and Ant Design `Collapse` accordions in `SummaryPanel` and `App`.

**Tech Stack:** Vite + React 18 + TypeScript, Ant Design 5.29, Vitest. Scripts: `npm test` (vitest run), `npm run typecheck`, `npm run build`.

---

## File Structure

- `src/domain/tree.ts` — add `CAPITAL_COMPONENT_TYPE` const, `capComponentCostReduction` field on `TreeParams`, apply reduction to `jobCost` in `buildNode`.
- `src/domain/tree.test.ts` — update `baseParams` for the new field; add a test for the reduction.
- `src/store/useCalculator.ts` — localStorage persistence helpers, new state `capComponentCostReduction` + setter, thread into `TreeParams`, stop clearing prices on root change.
- `src/components/SkillsPanel.tsx` — new `InputNumber` (0–100 %) for the reduction.
- `src/components/SummaryPanel.tsx` — wrap shopping list / categories / jobs in a `Collapse`.
- `src/App.tsx` — wire new props to `SkillsPanel`; wrap the craft tree in a (default-collapsed) `Collapse`.

**Note on scope:** The reduction affects only the cost shown in the tree/summary. Auto-optimization (`optimize.ts`) intentionally keeps deciding build-vs-buy on full job cost — left untouched per the spec's "keep it simple" decision.

---

## Task 1: Capital Component cost reduction (domain, TDD)

**Files:**
- Modify: `src/domain/tree.ts`
- Test: `src/domain/tree.test.ts`

- [ ] **Step 1: Add the new required field to existing `baseParams` so the suite still compiles**

In `src/domain/tree.test.ts`, update `baseParams` to include the new field (it does not exist yet on `TreeParams` — that is fine, we add it in Step 4; this keeps the test file ready):

```ts
function baseParams(data: GameData, buildSet: Set<number>): TreeParams {
  return {
    data,
    rootItemId: 1,
    desiredQty: 1,
    levels: new Map(),
    materialEfficiency: null,
    buildSet,
    priceOverrides: new Map(),
    capComponentCostReduction: 0,
  };
}
```

- [ ] **Step 2: Write the failing test**

Add to `src/domain/tree.test.ts`. Update the import line at the top to include `CAPITAL_COMPONENT_TYPE`:

```ts
import { buildTree, summarizeTree, CAPITAL_COMPONENT_TYPE, type TreeParams } from "./tree";
```

Then add this block after the existing `describe(...)` block (it defines its own data where the ship's material is a Capital Component):

```ts
describe("capComponentCostReduction", () => {
  // Ship(1) ← 2× CapComp(2, type=Capital Construction Components) ← 10× Mineral(3)
  function makeCapData(): GameData {
    const skillByName = new Map<string, Skill>([
      ["S", { name: "S", efficiency: [0, 0, 0, 0, 0], time: [0, 0, 0, 0, 0] }],
    ]);
    const shipBp: Recipe = {
      itemId: 1, name: "Ship", categoryName: "Ship", groupName: "Dread", kind: "manufacture",
      outputNumber: 1, manufactureCost: 1000, manufactureTime: 100, passRate: 1, skills: ["S"],
      materials: [{ id: 2, name: "CapComp", type: CAPITAL_COMPONENT_TYPE, quantity: 2 }],
    };
    const compBp: Recipe = {
      itemId: 2, name: "CapComp", categoryName: "Material", groupName: "Components", kind: "manufacture",
      outputNumber: 1, manufactureCost: 50, manufactureTime: 10, passRate: 1, skills: ["S"],
      materials: [{ id: 3, name: "Mineral", type: "Mineral", quantity: 10 }],
    };
    return {
      craftables: [],
      recipeByItemId: new Map([[1, shipBp], [2, compBp]]),
      priceByItemId: new Map([[2, 500], [3, 5], [1, 99999]]),
      iconByItemId: new Map(),
      skillByName,
      fetchedAt: 0,
    };
  }

  function capParams(reduction: number): TreeParams {
    return {
      data: makeCapData(),
      rootItemId: 1,
      desiredQty: 1,
      levels: new Map(),
      materialEfficiency: null,
      buildSet: new Set([2]), // build the capital component
      priceOverrides: new Map(),
      capComponentCostReduction: reduction,
    };
  }

  it("знижка 20% зменшує jobCost capital-компонента, не чіпаючи root", () => {
    const tree = buildTree(capParams(20));
    const comp = tree.children[0];
    expect(comp.type).toBe(CAPITAL_COMPONENT_TYPE);
    expect(comp.jobCost).toBe(50 * 2 * 0.8); // 80 (було 100)
    expect(tree.jobCost).toBe(1000); // root (type=Ship) без знижки

    const sum = summarizeTree(tree, capParams(20));
    expect(sum.totalJobCost).toBe(1000 + 80);
  });

  it("знижка 0% лишає jobCost без змін", () => {
    const tree = buildTree(capParams(0));
    expect(tree.children[0].jobCost).toBe(50 * 2);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- tree`
Expected: FAIL — TypeScript/runtime error that `CAPITAL_COMPONENT_TYPE` is not exported and/or `capComponentCostReduction` is not a known property.

- [ ] **Step 4: Implement in `src/domain/tree.ts`**

(a) Add the constant right after the imports (top of file, after the two `import` lines):

```ts
/** Тип матеріалу для капітальних компонентів (значення з блюпрінтів echoes.mobi). */
export const CAPITAL_COMPONENT_TYPE = "Capital Construction Components";
```

(b) Add the field to the `TreeParams` interface (after `priceOverrides`):

```ts
  priceOverrides: Map<number, number>;
  capComponentCostReduction: number; // % зниження ISK-вартості job для Capital Components (0–100)
```

(c) In `buildNode`, extend the destructuring of `params`:

```ts
  const { data, levels, materialEfficiency, buildSet, priceOverrides, capComponentCostReduction } =
    params;
```

(d) In `buildNode`, replace the line `const jobCost = r.manufactureCost * attempts;` with:

```ts
    const pct = Math.min(100, Math.max(0, capComponentCostReduction));
    const costFactor = type === CAPITAL_COMPONENT_TYPE ? 1 - pct / 100 : 1;
    const jobCost = r.manufactureCost * attempts * costFactor;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tree`
Expected: PASS — all `buildTree + summarizeTree` and `capComponentCostReduction` tests green.

- [ ] **Step 6: Run the full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/domain/tree.ts src/domain/tree.test.ts
git commit -m "feat(domain): capital component job cost reduction %

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Persist prices + reduction; new store state

**Files:**
- Modify: `src/store/useCalculator.ts`

- [ ] **Step 1: Add localStorage keys and helpers at module scope**

In `src/store/useCalculator.ts`, after the existing imports and the `NAGLFAR_ITEM_ID` const, add:

```ts
const PRICE_OVERRIDES_KEY = "ec-manufacturing:priceOverrides:v1";
const CAP_COST_KEY = "ec-manufacturing:capCostReduction:v1";

function loadPriceOverrides(): Map<number, number> {
  try {
    const raw = localStorage.getItem(PRICE_OVERRIDES_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, number>;
    return new Map(Object.entries(obj).map(([k, v]) => [Number(k), Number(v)]));
  } catch {
    return new Map();
  }
}

function savePriceOverrides(m: Map<number, number>): void {
  try {
    localStorage.setItem(PRICE_OVERRIDES_KEY, JSON.stringify(Object.fromEntries(m)));
  } catch {
    // localStorage недоступний / перевищено квоту — ігноруємо
  }
}

function loadCapCostReduction(): number {
  try {
    const raw = localStorage.getItem(CAP_COST_KEY);
    const n = raw == null ? 0 : Number(raw);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  } catch {
    return 0;
  }
}

function saveCapCostReduction(n: number): void {
  try {
    localStorage.setItem(CAP_COST_KEY, String(n));
  } catch {
    // ігноруємо
  }
}
```

- [ ] **Step 2: Add fields to the `Calculator` interface**

In the `Calculator` interface, after `resetPriceOverrides: () => void;` add:

```ts
  capComponentCostReduction: number;
  setCapComponentCostReduction: (pct: number) => void;
```

- [ ] **Step 3: Initialize state from localStorage**

Replace the line:

```ts
  const [priceOverrides, setPriceOverrides] = useState<Map<number, number>>(new Map());
```

with:

```ts
  const [priceOverrides, setPriceOverrides] = useState<Map<number, number>>(loadPriceOverrides);
  const [capComponentCostReduction, setCapCostReductionState] =
    useState<number>(loadCapCostReduction);
```

- [ ] **Step 4: Persist on change + add setter; add `useEffect` import**

Ensure `useEffect` is in the React import (it already is). After the existing `doLoad`/`refresh` effects area (anywhere among the hooks, e.g. right after `const refresh = ...`), add:

```ts
  useEffect(() => {
    savePriceOverrides(priceOverrides);
  }, [priceOverrides]);

  useEffect(() => {
    saveCapCostReduction(capComponentCostReduction);
  }, [capComponentCostReduction]);

  const setCapComponentCostReduction = useCallback((pct: number) => {
    setCapCostReductionState(Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0)));
  }, []);
```

- [ ] **Step 5: Stop clearing prices when the item changes**

In `handleSetRoot`, remove the `setPriceOverrides(new Map());` line. Result:

```ts
  const handleSetRoot = useCallback((id: number) => {
    setRootItemId(id);
    setManualBuildSet(new Set()); // скидаємо розкриття при зміні предмета
  }, []);
```

- [ ] **Step 6: Thread the reduction into the params passed to buildTree/summarizeTree and the optimizer's deps**

In the `buildSet` useMemo's `computeOptimalBuildSet({...})` call, leave it unchanged (optimizer does not use the reduction).

In the `{ tree, summary }` useMemo, add the field to `params`:

```ts
    const params = {
      data,
      rootItemId,
      desiredQty,
      levels: skillLevels,
      materialEfficiency,
      buildSet,
      priceOverrides,
      capComponentCostReduction,
    };
```

And add `capComponentCostReduction` to that useMemo's dependency array:

```ts
  }, [data, rootItemId, desiredQty, skillLevels, materialEfficiency, buildSet, priceOverrides, capComponentCostReduction]);
```

- [ ] **Step 7: Return the new fields**

In the returned object, after `resetPriceOverrides,` add:

```ts
    capComponentCostReduction,
    setCapComponentCostReduction,
```

- [ ] **Step 8: Typecheck + tests + build**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS — no type errors (the `TreeParams` object now has all required fields), all domain tests green, production build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/store/useCalculator.ts
git commit -m "feat(store): persist price overrides + cap cost reduction in localStorage

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Reduction input in SkillsPanel

**Files:**
- Modify: `src/components/SkillsPanel.tsx`

- [ ] **Step 1: Extend the Props interface**

In `src/components/SkillsPanel.tsx`, add to the `Props` interface after `onMaterialEfficiencyChange`:

```ts
  capComponentCostReduction: number;
  onCapComponentCostReductionChange: (pct: number) => void;
```

- [ ] **Step 2: Destructure the new props**

In the component signature destructuring, after `onMaterialEfficiencyChange,` add:

```ts
  capComponentCostReduction,
  onCapComponentCostReductionChange,
```

- [ ] **Step 3: Render the input**

Inside the top-level `<Space>`, immediately after the material-efficiency `<div>...</div>` block (the one ending with the `InputNumber addonAfter="%"` for material efficiency), add a new block:

```tsx
      <div>
        <Text>
          Знижка вартості job для Capital Components{" "}
          <Tooltip title="Зниження ISK-вартості виробництва капітальних компонентів (Capital Construction Components) — напр. від скілів Production Optimization. 0% = без знижки.">
            <Text type="secondary" style={{ cursor: "help" }}>
              ⓘ
            </Text>
          </Tooltip>
        </Text>
        <InputNumber
          style={{ width: "100%", marginTop: 4 }}
          min={0}
          max={100}
          step={1}
          value={capComponentCostReduction}
          addonAfter="%"
          onChange={(v) => onCapComponentCostReductionChange(v ?? 0)}
        />
      </div>
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: FAIL only in `App.tsx` (SkillsPanel now requires two new props not yet passed). This is expected and fixed in Task 4. SkillsPanel.tsx itself must have no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/SkillsPanel.tsx
git commit -m "feat(ui): capital component cost reduction input in skills panel

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Accordions + wire props in App and SummaryPanel

**Files:**
- Modify: `src/components/SummaryPanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Import `Collapse` in SummaryPanel**

In `src/components/SummaryPanel.tsx`, add `Collapse` to the antd import (the first import line), e.g.:

```ts
import { Button, Card, Col, Collapse, InputNumber, Row, Statistic, Table, Tag, Tooltip, Typography } from "antd";
```

- [ ] **Step 2: Replace the three large `Card` sections with a `Collapse`**

In `SummaryPanel`, the JSX currently has (after the two stat `Row`s): a `<Card title="Список покупок (агреговано)" ...>` containing the shopping `Table`, then a `<Row>` containing the "Підсумки по категоріях" and "Виробництво (jobs)" cards.

Replace **all of that** (from the shopping-list `<Card ...>` through the closing `</Row>` of the categories/jobs row) with a single `Collapse`:

```tsx
      <Collapse
        defaultActiveKey={["shopping"]}
        style={{ marginTop: 16 }}
        items={[
          {
            key: "shopping",
            label: "Список покупок (агреговано)",
            extra: (
              <Button
                size="small"
                icon={<UndoOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onResetPrices();
                }}
                disabled={priceOverrideCount === 0}
              >
                Скинути ціни
                {priceOverrideCount > 0 ? ` (${priceOverrideCount})` : ""}
              </Button>
            ),
            children: (
              <Table<AggregatedMaterial>
                columns={materialColumns}
                dataSource={summary.shoppingList}
                rowKey="itemId"
                pagination={false}
                size="small"
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={4}>
                      <Text strong>Разом матеріали</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <Text strong>{formatISK(summary.totalBuyCost)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            ),
          },
          {
            key: "categories",
            label: "Підсумки по категоріях",
            children: (
              <Table<CategorySubtotal>
                columns={categoryColumns}
                dataSource={summary.categorySubtotals}
                rowKey="type"
                pagination={false}
                size="small"
              />
            ),
          },
          {
            key: "jobs",
            label: `Виробництво (jobs) — ${summary.jobs.length} елем.`,
            children: (
              <Table<JobRow>
                columns={jobColumns}
                dataSource={summary.jobs}
                rowKey="itemId"
                pagination={false}
                size="small"
              />
            ),
          },
        ]}
      />
```

Leave the two stat `Row`s (the four-up and two-up `Statistic` cards) exactly as they are, above the `Collapse`.

- [ ] **Step 3: In App, import `Collapse` and wire SkillsPanel + tree accordion**

In `src/App.tsx`, add `Collapse` to the antd import line.

(a) Pass the new props to `<SkillsPanel .../>` — add after `onMaterialEfficiencyChange={calc.setMaterialEfficiency}`:

```tsx
                        capComponentCostReduction={calc.capComponentCostReduction}
                        onCapComponentCostReductionChange={calc.setCapComponentCostReduction}
```

(b) Replace the craft-tree `<Card title="Дерево крафту" size="small"> ... </Card>` block with a `Collapse` (default collapsed):

```tsx
                      <Collapse
                        items={[
                          {
                            key: "tree",
                            label: "Дерево крафту",
                            children: (
                              <CraftTree
                                tree={calc.tree}
                                rootItemId={calc.rootItemId}
                                auto={calc.auto}
                                onToggleBuild={calc.toggleBuild}
                                onPriceChange={calc.setPriceOverride}
                              />
                            ),
                          },
                        ]}
                      />
```

- [ ] **Step 4: Typecheck, tests, build**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS — no type errors, all domain tests green, build succeeds.

- [ ] **Step 5: Manual verification in the browser**

Run: `npm run dev`, open the local URL. Verify:
1. Shopping-list section is expanded by default; categories, jobs, and craft tree are collapsed; each toggles.
2. "Скинути ціни" inside the Список покупок header works and does NOT toggle the panel (click does not collapse it).
3. Edit a material price → switch the item in the selector and back → the custom price is still applied. Reload the page → the custom price persists. "Скинути ціни" clears it (and it stays cleared after reload).
4. Set "Знижка вартості job для Capital Components" to e.g. 20 with a capital build (Naglfar, expand a component to build) → "Вартість jobs" / "Разом (крафт)" drop accordingly; reload → value persists.

- [ ] **Step 6: Commit**

```bash
git add src/components/SummaryPanel.tsx src/App.tsx
git commit -m "feat(ui): collapse large sections into accordions; wire cap cost reduction

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** §1 persisted prices → Task 2 (persist + restore + no-clear-on-switch). §2 accordions → Task 4 (SummaryPanel Collapse + App tree Collapse; stat cards stay; shopping open / others closed). §3 cap component reduction → Task 1 (domain + test) + Task 3 (input) + Task 2 (state/persist) + Task 4 (wiring). Out-of-scope items remain out of scope.
- **Type consistency:** `capComponentCostReduction` (number) and `setCapComponentCostReduction` used identically across store, SkillsPanel props (`capComponentCostReduction` / `onCapComponentCostReductionChange`), and App wiring. `CAPITAL_COMPONENT_TYPE` exported from `tree.ts` and imported in the test.
- **No placeholders:** every code step shows full code and exact run commands.
