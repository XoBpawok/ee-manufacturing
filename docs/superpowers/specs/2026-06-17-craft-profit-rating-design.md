# Топ-50 найприбутковіших предметів для крафту

**Дата:** 2026-06-17
**Статус:** затверджено до реалізації

## Мета

Додати сторінку, що ранжує craftable-предмети за вигідністю крафту: для кожного
рахуємо `profit = ринкова ціна − вартість крафту` й показуємо топ-50 у таблиці з
трьома метриками (абсолютний прибуток ISK, маржа %, прибуток за годину ISK/год).

## Рішення (узгоджено з користувачем)

| Питання | Рішення |
|---|---|
| Метрика ранжування | Усі три як окремі сортовані колонки; сортування за замовчуванням — **ISK/год** (спадання) |
| База вартості крафту | **Крафтити все до сировини** (завжди будувати будь-який craftable-матеріал; купується лише сировина без рецепту) |
| Скоуп предметів | Усі рецепти, де відома і ринкова ціна предмета, і всі ціни матеріалів у ланцюгу (включно з реверсом) |
| Час для ISK/год | **Сума часу всього дерева** job-ів (верхній + усі компоненти) |
| UI | Окремий маршрут `/rating` |

## Архітектура

### Маршрутизація

Додати залежність `react-router-dom` (v6).

- `src/main.tsx` — обгорнути `<App/>` у `<BrowserRouter>`.
- `src/App.tsx` — стає layout-ом: antd `Layout` з `Header`, навігація antd `Menu`
  (горизонтальне) з двома пунктами; `<Outlet/>` для контенту маршруту.
  - `/` → `CalculatorPage`
  - `/rating` → `RatingPage`
- `src/pages/CalculatorPage.tsx` — поточний вміст калькулятора (винесений із `App.tsx`
  майже без змін: картка вибору предмета + Row зі скілами/підсумком/деревом).
- `src/pages/RatingPage.tsx` — нова сторінка рейтингу.

Стан гри (`useCalculator`) наразі тримається в калькуляторі. Рейтинг **не** залежить
від стану калькулятора — він самостійно завантажує `GameData` через `loadGameData`
(той самий кеш у localStorage, тож повторного мережевого запиту не буде) і читає
`priceOverrides` з localStorage.

> Розгляд альтернативи: hash-перемикач без залежності. Відхилено — `react-router`
> дає чисті URL і є стандартом; вартість залежності прийнятна.

### Ядро розрахунку — `src/domain/rating.ts` (чиста функція + тести)

```ts
import type { GameData, RecipeKind } from "../api/types";
import type { SkillLevels } from "./skills";

export interface CraftProfit {
  itemId: number;
  name: string;
  categoryName: string;
  groupName: string;
  kind: RecipeKind;
  iconUrl?: string;
  sellPrice: number;        // ринкова ціна предмета (або override)
  craftCost: number;        // повна вартість крафту до сировини, за одиницю
  profit: number;           // sellPrice − craftCost
  margin: number;           // profit / craftCost (частка; craftCost>0)
  craftTime: number;        // секунди, рекурсивно весь ланцюг, за одиницю
  profitPerHour: number;    // profit / (craftTime/3600); craftTime>0
}

export interface RatingParams {
  data: GameData;
  priceOverrides: Map<number, number>;
  levels: SkillLevels;      // базис скілів (за замовчуванням — порожня мапа = макс рівні)
  limit?: number;           // скільки повернути (default 50)
}

export function rankCraftProfits(params: RatingParams): CraftProfit[];
```

**Вартість і час "до сировини"** — рекурсивна memoized-функція `unitCostTime(itemId)`,
що повертає `{ cost, time, known }`:

- Якщо рецепт існує і немає циклу — **будуємо** (на відміну від `optimize.ts`, тут
  завжди build, без порівняння з купівлею):
  - для кожного матеріалу `m`: `child = unitCostTime(m.id)`, якщо у `m.id` нема рецепту
    — `child = { cost: buyPrice(m.id), time: 0, known: priceВідома }`.
  - `perUnit = recipe.kind === "manufacture" ? m.quantity × materialFactor(...) : m.quantity`
    (на макс скілах `materialFactor = 1`, тобто кількість блюпрінта).
  - `materialsCost = Σ child.cost × perUnit`; `materialsTime = Σ child.time × perUnit`.
  - `cost = (recipe.manufactureCost + materialsCost) / (outputNumber × passRate)`.
  - `time = (effectiveTime(recipe,...) + materialsTime) / (outputNumber × passRate)`.
  - `known = усі child.known` (інакше предмет виключається з рейтингу).
- Цикл (предмет уже `inProgress`) — у цій гілці предмет купується: `{ buyPrice, 0, known }`.
  Якщо ціни нема — `known = false`.

Формули дзеркалять `domain/optimize.ts` (`(manufactureCost + materials)/(outputNumber×passRate)`)
та `domain/skills.ts` (`materialFactor`, `effectiveTime`). Реверс обробляється через
`passRate` так само, як в `optimize.ts`/`tree.ts`.

**Ціни.** `buyPrice(itemId)` = `priceOverrides.get(id)` якщо є, інакше
`data.priceByItemId.get(id)`, інакше `undefined` (→ `known = false`). Ціна продажу
предмета — той самий пошук (override має пріоритет).

**Збірка результату.** Ітеруємо `data.recipeByItemId`. Для кожного предмета:
- `sellPrice` має бути відома; інакше пропуск.
- `{ cost, time, known } = unitCostTime(itemId)`; якщо `!known` — пропуск.
- рахуємо `profit/margin/profitPerHour` (guard на `craftCost===0` та `craftTime===0`).
- іконка через `iconUrl(data.iconByItemId.get(itemId))`.

Сортуємо за `profitPerHour` спадання, повертаємо перші `limit` (50).

### UI — `src/pages/RatingPage.tsx`

- Завантаження `GameData` (loading/error як у калькуляторі) + читання `priceOverrides`.
- `useMemo` → `rankCraftProfits({ data, priceOverrides, levels: new Map() })`.
- antd `Table` (rowKey=`itemId`):
  - **Предмет** — `<ItemIcon/>` + назва (перевикористати `components/ItemIcon`).
  - **Категорія** — `categoryName` (+ `groupName` підписом).
  - **Ціна продажу**, **Вартість крафту** — ISK через `format.ts`.
  - **Прибуток** (ISK) — `sorter`.
  - **Маржа** (%) — `sorter`.
  - **Час** — формат часу через `format.ts`.
  - **ISK/год** — `sorter`, дефолтний `defaultSortOrder: "descend"`.
- Клік по рядку → навігація на `/?item=<itemId>` (калькулятор читає `?item` із query і
  виставляє `rootItemId`). Опціонально — реалізувати, якщо просто; інакше пропустити.

### Тести — `src/domain/rating.test.ts` (vitest)

Синтетичний `GameData` (як у `optimize.test.ts`):

1. Простий manufacture-предмет із 2 сировинних матеріалів → перевірка `craftCost`,
   `profit`, `margin`, `craftTime`, `profitPerHour`.
2. Дворівневий ланцюг (компонент із власним рецептом) → рекурсивна вартість і час
   агрегуються (build everything to raw).
3. Реверс із `passRate < 1` → вартість/час діляться на `passRate`.
4. Предмет із матеріалом без ціни → виключений (`known=false`).
5. Сортування за `profitPerHour` і обрізання до `limit`.

## Поза скоупом

- Підв'язка реальних скілів калькулятора до рейтингу (поки макс рівні).
- Облік об'ємів ринку / ліквідності.
- Пагінація понад топ-50.
