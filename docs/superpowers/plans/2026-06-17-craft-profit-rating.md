# Craft Profit Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Додати маршрут `/rating` із таблицею топ-50 craftable-предметів, ранжованих за вигідністю крафту (прибуток ISK, маржа %, ISK/год).

**Architecture:** Чиста функція `domain/rating.ts` рекурсивно рахує вартість/час крафту «до сировини» (дзеркалить формули `optimize.ts`/`skills.ts`) і повертає відсортований список `CraftProfit`. UI розбивається на маршрути через `react-router-dom`: `App.tsx` стає layout-ом із навігацією, поточний калькулятор виноситься в `pages/CalculatorPage.tsx`, рейтинг — `pages/RatingPage.tsx`.

**Tech Stack:** Vite + React 18 + TypeScript, Ant Design, react-router-dom v6, vitest.

---

## File Structure

- Create: `src/domain/rating.ts` — чиста функція ранжування + типи.
- Create: `src/domain/rating.test.ts` — vitest-тести функції.
- Create: `src/pages/CalculatorPage.tsx` — поточний вміст калькулятора (винесений з `App.tsx`).
- Create: `src/pages/RatingPage.tsx` — сторінка рейтингу (таблиця).
- Modify: `src/App.tsx` — layout із antd `Menu` + `<Outlet/>`.
- Modify: `src/main.tsx` — `BrowserRouter` + `Routes`.
- Modify: `src/store/useCalculator.ts` — експортувати `loadPriceOverrides` для перевикористання в `RatingPage`.
- Modify: `package.json` — додати `react-router-dom`.

---

## Task 1: Чиста функція рейтингу `domain/rating.ts`

**Files:**
- Create: `src/domain/rating.ts`
- Test: `src/domain/rating.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/domain/rating.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { GameData, Recipe } from "../api/types";
import { rankCraftProfits } from "./rating";

function gameData(recipes: Recipe[], prices: [number, number][]): GameData {
  return {
    craftables: [],
    recipeByItemId: new Map(recipes.map((r) => [r.itemId, r])),
    priceByItemId: new Map(prices),
    iconByItemId: new Map(),
    skillByName: new Map(),
    fetchedAt: 0,
  };
}

const noOverrides = new Map<number, number>();
const noLevels = new Map<string, number>();

const mk = (over: Partial<Recipe> & Pick<Recipe, "itemId" | "materials">): Recipe => ({
  name: `Item ${over.itemId}`, categoryName: "Cat", groupName: "G", kind: "manufacture",
  outputNumber: 1, manufactureCost: 0, manufactureTime: 0, passRate: 1, skills: [],
  ...over,
});

describe("rankCraftProfits", () => {
  it("рахує вартість, прибуток, маржу й ISK/год для простого рецепту", () => {
    const widget = mk({
      itemId: 1, manufactureCost: 1000, manufactureTime: 100,
      materials: [{ id: 2, name: "Raw", type: "Mineral", quantity: 2 }],
    });
    const data = gameData([widget], [[1, 5000], [2, 100]]);
    const [row] = rankCraftProfits({ data, priceOverrides: noOverrides, levels: noLevels });
    // craftCost = (1000 + 100×2)/1 = 1200
    expect(row.craftCost).toBe(1200);
    expect(row.sellPrice).toBe(5000);
    expect(row.profit).toBe(3800);
    expect(row.margin).toBeCloseTo(3800 / 1200);
    expect(row.craftTime).toBe(100);
    expect(row.profitPerHour).toBeCloseTo(3800 / (100 / 3600));
  });

  it("рекурсивно будує компоненти до сировини (вартість і час)", () => {
    const ship = mk({
      itemId: 1, manufactureCost: 1000, manufactureTime: 100,
      materials: [{ id: 2, name: "Comp", type: "Component", quantity: 2 }],
    });
    const comp = mk({
      itemId: 2, manufactureCost: 50, manufactureTime: 10,
      materials: [{ id: 3, name: "Min", type: "Mineral", quantity: 10 }],
    });
    const data = gameData([ship, comp], [[1, 99999], [2, 777], [3, 5]]);
    const row = rankCraftProfits({ data, priceOverrides: noOverrides, levels: noLevels })
      .find((r) => r.itemId === 1)!;
    // comp = (50 + 5×10)/1 = 100; ship = (1000 + 100×2)/1 = 1200
    expect(row.craftCost).toBe(1200);
    // comp time = (10 + 0×10)/1 = 10; ship time = (100 + 10×2)/1 = 120
    expect(row.craftTime).toBe(120);
  });

  it("враховує pass_rate реверсу (вартість і час діляться на passRate)", () => {
    const re = mk({
      itemId: 5, kind: "reverse", manufactureCost: 100, manufactureTime: 60, passRate: 0.5,
      materials: [{ id: 6, name: "Base", type: "Base", quantity: 1 }],
    });
    const data = gameData([re], [[5, 5000], [6, 100]]);
    const [row] = rankCraftProfits({ data, priceOverrides: noOverrides, levels: noLevels });
    // cost = (100 + 100×1)/(1×0.5) = 400; time = (60 + 0)/0.5 = 120
    expect(row.craftCost).toBe(400);
    expect(row.craftTime).toBe(120);
  });

  it("виключає предмет, якщо в ланцюгу є матеріал без ціни", () => {
    const widget = mk({
      itemId: 1, manufactureCost: 1000,
      materials: [{ id: 2, name: "Raw", type: "Mineral", quantity: 2 }],
    });
    // id2 не має ні рецепту, ні ціни → known=false
    const data = gameData([widget], [[1, 5000]]);
    const rows = rankCraftProfits({ data, priceOverrides: noOverrides, levels: noLevels });
    expect(rows.find((r) => r.itemId === 1)).toBeUndefined();
  });

  it("сортує за ISK/год спадання й обрізає до limit", () => {
    const lo = mk({
      itemId: 1, manufactureCost: 0, manufactureTime: 3600,
      materials: [{ id: 9, name: "R", type: "Mineral", quantity: 1 }],
    });
    const hi = mk({
      itemId: 2, manufactureCost: 0, manufactureTime: 3600,
      materials: [{ id: 9, name: "R", type: "Mineral", quantity: 1 }],
    });
    // обидва: cost=10, time=3600(1год); profit lo=90, hi=990 → hi вище
    const data = gameData([lo, hi], [[1, 100], [2, 1000], [9, 10]]);
    const rows = rankCraftProfits({ data, priceOverrides: noOverrides, levels: noLevels, limit: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0].itemId).toBe(2);
  });

  it("override ціни перекриває ринкову для матеріалів і предмета", () => {
    const widget = mk({
      itemId: 1, manufactureCost: 0, manufactureTime: 100,
      materials: [{ id: 2, name: "Raw", type: "Mineral", quantity: 1 }],
    });
    const data = gameData([widget], [[1, 5000], [2, 100]]);
    const overrides = new Map<number, number>([[2, 1]]); // здешевлюємо сировину
    const [row] = rankCraftProfits({ data, priceOverrides: overrides, levels: noLevels });
    expect(row.craftCost).toBe(1); // (0 + 1×1)/1
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/rating.test.ts`
Expected: FAIL — `rating.ts` не існує / `rankCraftProfits` не визначено.

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/rating.ts`:

```ts
import type { GameData, RecipeKind } from "../api/types";
import { iconUrl } from "../api/types";
import { effectiveTime, materialFactor, type SkillLevels } from "./skills";

export interface CraftProfit {
  itemId: number;
  name: string;
  categoryName: string;
  groupName: string;
  kind: RecipeKind;
  iconUrl?: string;
  sellPrice: number; // ринкова ціна предмета (або override)
  craftCost: number; // повна вартість крафту до сировини, за одиницю
  profit: number; // sellPrice − craftCost
  margin: number; // profit / craftCost (частка; craftCost>0)
  craftTime: number; // секунди, рекурсивно весь ланцюг, за одиницю
  profitPerHour: number; // profit / (craftTime/3600); craftTime>0
}

export interface RatingParams {
  data: GameData;
  priceOverrides: Map<number, number>;
  levels: SkillLevels; // базис скілів (порожня мапа = макс рівні)
  limit?: number; // скільки повернути (default 50)
}

interface UnitCT {
  cost: number; // вартість за одиницю
  time: number; // секунди за одиницю
  known: boolean; // чи відомі всі ціни в ланцюгу
}

/**
 * Ранжує craftable-предмети за вигідністю крафту «до сировини».
 *
 * Вартість/час рахуються рекурсивно: будь-який craftable-матеріал завжди
 * будується, купується лише сировина без рецепту. Формула на одиницю дзеркалить
 * domain/optimize.ts: (manufactureCost + Σ child×qty) / (outputNumber × passRate).
 * Базис скілів — максимальні рівні (materialFactor=1), тож кількості/час блюпрінта.
 */
export function rankCraftProfits(params: RatingParams): CraftProfit[] {
  const { data, priceOverrides, levels, limit = 50 } = params;
  const memo = new Map<number, UnitCT>();
  const inProgress = new Set<number>();

  const buyPrice = (itemId: number): number | undefined => {
    if (priceOverrides.has(itemId)) return priceOverrides.get(itemId)!;
    return data.priceByItemId.get(itemId);
  };

  const unit = (itemId: number): UnitCT => {
    const cached = memo.get(itemId);
    if (cached) return cached;
    const recipe = data.recipeByItemId.get(itemId);
    // Лист (нема рецепту) або цикл — купуємо.
    if (!recipe || inProgress.has(itemId)) {
      const p = buyPrice(itemId);
      return { cost: p ?? 0, time: 0, known: p != null };
    }
    inProgress.add(itemId);
    let materialsCost = 0;
    let materialsTime = 0;
    let known = true;
    for (const m of recipe.materials) {
      const child = unit(m.id);
      if (!child.known) known = false;
      const perUnit =
        recipe.kind === "manufacture"
          ? m.quantity * materialFactor(recipe, levels, data.skillByName, null)
          : m.quantity;
      materialsCost += child.cost * perUnit;
      materialsTime += child.time * perUnit;
    }
    inProgress.delete(itemId);
    const denom = recipe.outputNumber * recipe.passRate;
    const cost = (recipe.manufactureCost + materialsCost) / denom;
    const time = (effectiveTime(recipe, levels, data.skillByName) + materialsTime) / denom;
    const result: UnitCT = { cost, time, known };
    memo.set(itemId, result);
    return result;
  };

  const out: CraftProfit[] = [];
  for (const [itemId, recipe] of data.recipeByItemId) {
    const sell = buyPrice(itemId);
    if (sell == null) continue;
    const { cost, time, known } = unit(itemId);
    if (!known) continue;
    const profit = sell - cost;
    out.push({
      itemId,
      name: recipe.name,
      categoryName: recipe.categoryName,
      groupName: recipe.groupName,
      kind: recipe.kind,
      iconUrl: iconUrl(data.iconByItemId.get(itemId)),
      sellPrice: sell,
      craftCost: cost,
      profit,
      margin: cost > 0 ? profit / cost : 0,
      craftTime: time,
      profitPerHour: time > 0 ? profit / (time / 3600) : 0,
    });
  }
  out.sort((a, b) => b.profitPerHour - a.profitPerHour);
  return out.slice(0, limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/rating.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/rating.ts src/domain/rating.test.ts
git commit -m "feat(domain): craft profit rating (cost-to-raw, profit/margin/ISK-per-hour)"
```

---

## Task 2: Маршрутизація — залежність, layout, винесення калькулятора

**Files:**
- Modify: `package.json` (через `npm install`)
- Modify: `src/store/useCalculator.ts` (експорт `loadPriceOverrides`)
- Create: `src/pages/CalculatorPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Install react-router-dom**

Run: `npm install react-router-dom@^6`
Expected: додано в `dependencies` `package.json`, без помилок.

- [ ] **Step 2: Export `loadPriceOverrides` from the store**

У `src/store/useCalculator.ts` зробити функцію `loadPriceOverrides` експортованою. Знайти:

```ts
function loadPriceOverrides(): Map<number, number> {
```

Замінити на:

```ts
export function loadPriceOverrides(): Map<number, number> {
```

- [ ] **Step 3: Create `src/pages/CalculatorPage.tsx` with the calculator body**

Перенести поточний вміст калькулятора з `App.tsx`. Зміст файлу:

```tsx
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  InputNumber,
  Row,
  Space,
  Spin,
  Switch,
  Tooltip,
  Typography,
} from "antd";
import { ReloadOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { ItemSelector } from "../components/ItemSelector";
import { SkillsPanel } from "../components/SkillsPanel";
import { CraftTree } from "../components/CraftTree";
import { SummaryPanel } from "../components/SummaryPanel";
import { useCalculator } from "../store/useCalculator";

const { Text } = Typography;

export function CalculatorPage() {
  const calc = useCalculator();

  return (
    <>
      {calc.loading && (
        <div style={{ textAlign: "center", padding: 80 }}>
          <Spin size="large" tip="Завантаження даних гри…">
            <div style={{ padding: 40 }} />
          </Spin>
        </div>
      )}

      {calc.error && (
        <Alert
          type="error"
          message="Не вдалося завантажити дані"
          description={calc.error}
          action={
            <Button onClick={calc.refresh} icon={<ReloadOutlined />}>
              Повторити
            </Button>
          }
          showIcon
        />
      )}

      {calc.data && (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Card size="small">
            <Space wrap align="center" size="large">
              <Space direction="vertical" size={2}>
                <Text type="secondary">Предмет</Text>
                <ItemSelector
                  data={calc.data}
                  value={calc.rootItemId}
                  onChange={calc.setRootItemId}
                />
              </Space>
              <Space direction="vertical" size={2}>
                <Text type="secondary">Кількість</Text>
                <InputNumber
                  min={1}
                  value={calc.desiredQty}
                  onChange={(v) => calc.setDesiredQty(Number(v) || 1)}
                />
              </Space>
              <Space direction="vertical" size={2}>
                <Text type="secondary">
                  <ThunderboltOutlined /> Авто-оптимізація
                </Text>
                <Tooltip title="Автоматично вибирати дешевше: купити чи крафтити (включно з реверс-інжинірингом) для кожного компонента">
                  <Switch
                    checked={calc.auto}
                    onChange={calc.setAuto}
                    checkedChildren="авто"
                    unCheckedChildren="вручну"
                  />
                </Tooltip>
              </Space>
              <Button icon={<ReloadOutlined />} onClick={calc.refresh}>
                Оновити дані
              </Button>
            </Space>
          </Card>

          {!calc.tree || !calc.summary ? (
            <Alert type="warning" showIcon message="Для цього предмета немає блюпрінта" />
          ) : (
            <Row gutter={[16, 16]}>
              <Col xs={24} xl={6}>
                <Card title="Скіли індустрії" size="small">
                  <SkillsPanel
                    data={calc.data}
                    relevantSkills={calc.summary.relevantSkills}
                    skillLevels={calc.skillLevels}
                    onChange={calc.setSkillLevel}
                    onReset={calc.resetSkills}
                    materialEfficiency={calc.materialEfficiency}
                    onMaterialEfficiencyChange={calc.setMaterialEfficiency}
                    capComponentCostReduction={calc.capComponentCostReduction}
                    onCapComponentCostReductionChange={calc.setCapComponentCostReduction}
                  />
                </Card>
              </Col>
              <Col xs={24} xl={18}>
                <Space direction="vertical" size="large" style={{ width: "100%" }}>
                  <SummaryPanel
                    summary={calc.summary}
                    onPriceChange={calc.setPriceOverride}
                    onResetPrices={calc.resetPriceOverrides}
                    priceOverrides={calc.priceOverrides}
                    marketPrices={calc.data.priceByItemId}
                  />
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
                </Space>
              </Col>
            </Row>
          )}
        </Space>
      )}
    </>
  );
}
```

- [ ] **Step 4: Rewrite `src/App.tsx` as a layout with navigation**

Замінити повністю вміст `src/App.tsx` на:

```tsx
import { ConfigProvider, Layout, Menu, Typography, theme } from "antd";
import ukUA from "antd/locale/uk_UA";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const { Header, Content } = Layout;
const { Title } = Typography;

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <ConfigProvider locale={ukUA} theme={{ algorithm: theme.defaultAlgorithm }}>
      <Layout style={{ minHeight: "100vh" }}>
        <Header style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Title level={4} style={{ color: "#fff", margin: 0, whiteSpace: "nowrap" }}>
            EVE Echoes
          </Title>
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[location.pathname === "/rating" ? "/rating" : "/"]}
            onClick={(e) => navigate(e.key)}
            items={[
              { key: "/", label: "Калькулятор" },
              { key: "/rating", label: "Топ прибуткових" },
            ]}
            style={{ flex: 1, minWidth: 0 }}
          />
        </Header>
        <Content style={{ padding: 24, width: "100%" }}>
          <Outlet />
        </Content>
      </Layout>
    </ConfigProvider>
  );
}
```

- [ ] **Step 5: Wire routes in `src/main.tsx`**

Замінити повністю вміст `src/main.tsx` на:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "antd/dist/reset.css";
import App from "./App";
import { CalculatorPage } from "./pages/CalculatorPage";
import { RatingPage } from "./pages/RatingPage";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<CalculatorPage />} />
          <Route path="rating" element={<RatingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
```

> Примітка: `RatingPage` створюється в Task 3. До того typecheck/збірка тимчасово впаде на цьому імпорті — це очікувано; цей таск завершуємо разом із Task 3 перед перевіркою. Коміт цього таска робимо після Task 3 Step 3, або одразу створіть порожній `RatingPage`-стаб у Task 3 першим. Виконуйте Task 3 одразу після цього.

- [ ] **Step 6: Commit (разом із Task 3)**

Коміт виконується наприкінці Task 3 (Step 5), бо `main.tsx` посилається на `RatingPage`.

---

## Task 3: Сторінка рейтингу `pages/RatingPage.tsx`

**Files:**
- Create: `src/pages/RatingPage.tsx`

- [ ] **Step 1: Create `src/pages/RatingPage.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Space, Spin, Table, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { loadGameData } from "../api/client";
import type { GameData } from "../api/types";
import { rankCraftProfits, type CraftProfit } from "../domain/rating";
import { loadPriceOverrides } from "../store/useCalculator";
import { ItemIcon } from "../components/ItemIcon";
import { formatDuration, formatISK } from "../domain/format";

const { Text } = Typography;

const columns: ColumnsType<CraftProfit> = [
  {
    title: "Предмет",
    dataIndex: "name",
    key: "name",
    render: (_: string, r: CraftProfit) => (
      <Space>
        <ItemIcon src={r.iconUrl} />
        <span>{r.name}</span>
        {r.kind === "reverse" && <Tag color="purple">реверс</Tag>}
      </Space>
    ),
  },
  {
    title: "Категорія",
    dataIndex: "categoryName",
    key: "categoryName",
    render: (_: string, r: CraftProfit) => (
      <Space direction="vertical" size={0}>
        <span>{r.categoryName}</span>
        <Text type="secondary" style={{ fontSize: 12 }}>{r.groupName}</Text>
      </Space>
    ),
  },
  {
    title: "Ціна продажу",
    dataIndex: "sellPrice",
    key: "sellPrice",
    align: "right",
    sorter: (a, b) => a.sellPrice - b.sellPrice,
    render: (v: number) => formatISK(v),
  },
  {
    title: "Вартість крафту",
    dataIndex: "craftCost",
    key: "craftCost",
    align: "right",
    sorter: (a, b) => a.craftCost - b.craftCost,
    render: (v: number) => formatISK(v),
  },
  {
    title: "Прибуток",
    dataIndex: "profit",
    key: "profit",
    align: "right",
    sorter: (a, b) => a.profit - b.profit,
    render: (v: number) => (
      <Text type={v >= 0 ? "success" : "danger"}>{formatISK(v)}</Text>
    ),
  },
  {
    title: "Маржа",
    dataIndex: "margin",
    key: "margin",
    align: "right",
    sorter: (a, b) => a.margin - b.margin,
    render: (v: number) => `${(v * 100).toFixed(1)}%`,
  },
  {
    title: "Час",
    dataIndex: "craftTime",
    key: "craftTime",
    align: "right",
    sorter: (a, b) => a.craftTime - b.craftTime,
    render: (v: number) => formatDuration(v),
  },
  {
    title: "ISK/год",
    dataIndex: "profitPerHour",
    key: "profitPerHour",
    align: "right",
    defaultSortOrder: "descend",
    sorter: (a, b) => a.profitPerHour - b.profitPerHour,
    render: (v: number) => formatISK(v),
  },
];

export function RatingPage() {
  const [data, setData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loadGameData(reloadKey > 0)
      .then((d) => {
        if (active) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (active) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const rows = useMemo(() => {
    if (!data) return [];
    return rankCraftProfits({ data, priceOverrides: loadPriceOverrides(), levels: new Map() });
  }, [data]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" tip="Обчислення рейтингу…">
          <div style={{ padding: 40 }} />
        </Spin>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="Не вдалося завантажити дані"
        description={error}
        action={
          <Button onClick={() => setReloadKey((k) => k + 1)} icon={<ReloadOutlined />}>
            Повторити
          </Button>
        }
        showIcon
      />
    );
  }

  return (
    <Card
      title="Топ-50 найприбутковіших для крафту"
      extra={
        <Button icon={<ReloadOutlined />} onClick={() => setReloadKey((k) => k + 1)}>
          Оновити дані
        </Button>
      }
    >
      <Text type="secondary">
        Вартість крафту рахується «до сировини» (будуються всі компоненти) на
        максимальних скілах. Ціни — ринкові (з урахуванням ваших перевизначень).
      </Text>
      <Table<CraftProfit>
        style={{ marginTop: 16 }}
        rowKey="itemId"
        columns={columns}
        dataSource={rows}
        size="small"
        pagination={false}
        scroll={{ x: true }}
      />
    </Card>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — нема помилок типів (усі імпорти `RatingPage`/`CalculatorPage`/`loadPriceOverrides` резолвляться).

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — усі тести (включно з `rating.test.ts`).

- [ ] **Step 4: Build to verify the app compiles**

Run: `npm run build`
Expected: успішна збірка без помилок.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/main.tsx src/App.tsx src/store/useCalculator.ts src/pages/CalculatorPage.tsx src/pages/RatingPage.tsx
git commit -m "feat(ui): top-50 craft profit rating page with routing"
```

---

## Manual verification (after Task 3)

- [ ] `npm run dev`, відкрити `/` — калькулятор працює як раніше (вибір предмета, скіли, дерево).
- [ ] Перейти в меню «Топ прибуткових» (`/rating`) — таблиця з ~50 рядками, відсортована за ISK/год спадання.
- [ ] Клік по заголовках колонок «Прибуток», «Маржа», «ISK/год» змінює сортування.
- [ ] Перевизначити ціну матеріалу в калькуляторі → повернутись у рейтинг, «Оновити дані» → вартість крафту враховує override.

## Self-Review notes

- **Spec coverage:** маршрут `/rating` (Task 2), функція `rankCraftProfits` із усіма метриками + cost-to-raw + reverse + priceOverrides (Task 1), таблиця з трьома сортованими колонками й дефолтним ISK/год (Task 3), тести 6 шт. (Task 1). Опціональний перехід «клік по рядку → калькулятор» свідомо не реалізовано (позначено в спеці як опціональне) — YAGNI.
- **Type consistency:** `CraftProfit`/`RatingParams` визначені в Task 1 і використані ідентично в Task 3; `loadPriceOverrides` експорт додано в Task 2 і імпортовано в Task 3.
- **Placeholder scan:** код повний у кожному кроці; коміт `main.tsx` свідомо відкладено до Task 3 через крос-файлову залежність (пояснено в Task 2 Step 5).
