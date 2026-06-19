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
  sellPrice: number; // market price of the item (or override)
  sellPriceMarket: number; // market price of the product (estimated_price)
  sellIsOverride: boolean; // whether the sell price is a user override
  craftCost: number; // full craft cost down to raw materials, per unit
  craftCostMarket: number; // craft cost using market prices only (no overrides)
  profit: number; // sellPrice − craftCost
  margin: number; // profit / craftCost (fraction; craftCost>0)
  craftTime: number; // seconds, recursively the whole chain, per unit
  profitPerHour: number; // profit / (craftTime/3600); craftTime>0
}

export interface RatingParams {
  data: GameData;
  priceOverrides: Map<number, number>;
  levels: SkillLevels; // skill basis (empty map = max levels)
  limit?: number; // how many to return (default 50)
  enabledCategories?: Set<string>; // if set — only these categories (undefined = all)
}

/** Sorted unique list of categories across all recipes (for the filter toggles). */
export function recipeCategories(data: GameData): string[] {
  const set = new Set<string>();
  for (const recipe of data.recipeByItemId.values()) set.add(recipe.categoryName);
  return [...set].sort();
}

interface UnitCT {
  cost: number; // cost per unit
  costMarket: number; // cost per unit using market prices only
  time: number; // seconds per unit
  known: boolean; // whether all prices in the chain are known
}

/**
 * Ranks craftable items by craft profitability "down to raw materials".
 *
 * Cost/time are computed recursively: any craftable material is always built,
 * only raw materials without a recipe are bought. The per-unit formula mirrors
 * domain/optimize.ts: (manufactureCost + Σ child×qty) / (outputNumber × passRate).
 * The skill basis is max levels (materialFactor=1), i.e. blueprint quantities/time.
 */
export function rankCraftProfits(params: RatingParams): CraftProfit[] {
  const { data, priceOverrides, levels, limit = 50, enabledCategories } = params;
  const memo = new Map<number, UnitCT>();
  const inProgress = new Set<number>();

  const buyPrice = (itemId: number): number | undefined => {
    if (priceOverrides.has(itemId)) return priceOverrides.get(itemId)!;
    return data.priceByItemId.get(itemId);
  };

  const marketPrice = (itemId: number): number | undefined => data.priceByItemId.get(itemId);

  const unit = (itemId: number): UnitCT => {
    const cached = memo.get(itemId);
    if (cached) return cached;
    const recipe = data.recipeByItemId.get(itemId);
    // Leaf (no recipe) or cycle — buy.
    if (!recipe || inProgress.has(itemId)) {
      const p = buyPrice(itemId);
      const pm = marketPrice(itemId);
      return { cost: p ?? 0, costMarket: pm ?? p ?? 0, time: 0, known: p != null };
    }
    inProgress.add(itemId);
    let materialsCost = 0;
    let materialsCostMarket = 0;
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
      materialsCostMarket += child.costMarket * perUnit;
      materialsTime += child.time * perUnit;
    }
    inProgress.delete(itemId);
    // Reverse does not consume blueprints (it produces them), so for kind === "reverse"
    // we do not charge the cost of its own blueprint.
    const blueprintCost = recipe.kind === "reverse" ? 0 : buyPrice(recipe.blueprintId) ?? 0;
    const blueprintCostMarket =
      recipe.kind === "reverse" ? 0 : marketPrice(recipe.blueprintId) ?? 0;
    const denom = recipe.outputNumber * recipe.passRate;
    const cost = (recipe.manufactureCost + blueprintCost + materialsCost) / denom;
    const costMarket = (recipe.manufactureCost + blueprintCostMarket + materialsCostMarket) / denom;
    const time = (effectiveTime(recipe, levels, data.skillByName) + materialsTime) / denom;
    const result: UnitCT = { cost, costMarket, time, known };
    memo.set(itemId, result);
    return result;
  };

  const out: CraftProfit[] = [];
  for (const [itemId, recipe] of data.recipeByItemId) {
    if (enabledCategories && !enabledCategories.has(recipe.categoryName)) continue;
    const sell = buyPrice(itemId);
    if (sell == null) continue;
    const { cost, costMarket, time, known } = unit(itemId);
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
      sellPriceMarket: marketPrice(itemId) ?? sell,
      sellIsOverride: priceOverrides.has(itemId),
      craftCost: cost,
      craftCostMarket: costMarket,
      profit,
      margin: cost > 0 ? profit / cost : 0,
      craftTime: time,
      profitPerHour: time > 0 ? profit / (time / 3600) : 0,
    });
  }
  out.sort((a, b) => b.profitPerHour - a.profitPerHour);
  return out.slice(0, limit);
}
