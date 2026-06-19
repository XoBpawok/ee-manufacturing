import type { GameData } from "../api/types";
import { materialFactor, type SkillLevels } from "./skills";

export interface OptimizeParams {
  data: GameData;
  rootItemId: number;
  levels: SkillLevels;
  materialEfficiency: number | null; // manual ME (%), null = by skills
  priceOverrides: Map<number, number>;
}

interface UnitCost {
  cost: number; // minimum cost per unit
  build: boolean; // whether crafting is cheaper than buying
}

/**
 * Computes the cheapest source for each item (buy vs craft), recursively
 * accounting for sub-material cost, skills and the reverse pass_rate.
 * Returns the set of itemId that are cheaper to craft (for buildSet).
 *
 * The decision uses continuous (unrounded) per-unit costs.
 */
export function computeOptimalBuildSet(params: OptimizeParams): Set<number> {
  const { data, rootItemId, levels, materialEfficiency, priceOverrides } = params;
  const memo = new Map<number, UnitCost>();
  const inProgress = new Set<number>();

  const buyUnit = (itemId: number): number => {
    if (priceOverrides.has(itemId)) return priceOverrides.get(itemId)!;
    const est = data.priceByItemId.get(itemId);
    return est != null ? est : Infinity;
  };

  const unit = (itemId: number): UnitCost => {
    const cached = memo.get(itemId);
    if (cached) return cached;
    if (inProgress.has(itemId)) {
      // Cycle — in this branch the item can only be bought.
      return { cost: buyUnit(itemId), build: false };
    }

    const buy = buyUnit(itemId);
    const recipe = data.recipeByItemId.get(itemId);
    let craft = Infinity;

    if (recipe) {
      inProgress.add(itemId);
      let materials = 0;
      for (const m of recipe.materials) {
        const childUnit = unit(m.id).cost;
        const perUnit =
          recipe.kind === "manufacture"
            ? m.quantity * materialFactor(recipe, levels, data.skillByName, materialEfficiency)
            : m.quantity;
        materials += childUnit * perUnit;
      }
      inProgress.delete(itemId);
      // Reverse does not consume blueprints (it produces them), so blueprint cost
      // applies only to manufacture. If the blueprint is craftable, take the min of
      // buy/craft; otherwise the market price (unknown → 0).
      let blueprintCost = 0;
      if (recipe.kind === "manufacture") {
        if (data.recipeByItemId.has(recipe.blueprintId)) {
          const u = unit(recipe.blueprintId).cost;
          blueprintCost = Number.isFinite(u) ? u : 0;
        } else {
          blueprintCost = priceOverrides.has(recipe.blueprintId)
            ? priceOverrides.get(recipe.blueprintId)!
            : data.priceByItemId.get(recipe.blueprintId) ?? 0;
        }
      }
      // Cost per produced unit. For reverse, divide by pass_rate
      // (expected attempts per success) and by output_number.
      craft =
        (recipe.manufactureCost + blueprintCost + materials) / (recipe.outputNumber * recipe.passRate);
    }

    const build = craft < buy;
    const result: UnitCost = { cost: Math.min(buy, craft), build };
    memo.set(itemId, result);
    return result;
  };

  const buildSet = new Set<number>();
  const collect = (itemId: number, visited: Set<number>): void => {
    const recipe = data.recipeByItemId.get(itemId);
    if (!recipe) return;
    for (const m of recipe.materials) {
      if (!data.recipeByItemId.has(m.id)) continue;
      if (unit(m.id).build) {
        buildSet.add(m.id);
        if (!visited.has(m.id)) collect(m.id, new Set(visited).add(itemId));
      }
    }
    // A manufacture recipe's blueprint may also be cheaper to craft (via reverse).
    if (recipe.kind === "manufacture" && data.recipeByItemId.has(recipe.blueprintId)) {
      const bpId = recipe.blueprintId;
      if (unit(bpId).build) {
        buildSet.add(bpId);
        if (!visited.has(bpId)) collect(bpId, new Set(visited).add(itemId));
      }
    }
  };

  // The root is always crafted (it is the target item).
  collect(rootItemId, new Set([rootItemId]));
  return buildSet;
}
