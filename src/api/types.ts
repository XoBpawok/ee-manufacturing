// Normalized domain types (after parsing string→number from the API).

export interface Material {
  id: number;
  name: string;
  type: string;
  quantity: number;
}

export type RecipeKind = "manufacture" | "reverse";

/**
 * Item production recipe. The two recipe sources (manufacturing and reverse
 * engineering) do not overlap — each item has at most one recipe.
 */
export interface Recipe {
  itemId: number;
  blueprintId: number; // own id of the blueprint recipe (for the blueprint price)
  name: string;
  categoryName: string;
  groupName: string;
  kind: RecipeKind;
  outputNumber: number;
  manufactureCost: number;
  manufactureTime: number; // seconds
  passRate: number; // success probability (1 for manufacturing, <1 for reverse)
  skills: string[]; // names of relevant skills
  materials: Material[];
}

export interface Skill {
  name: string;
  efficiency: number[]; // % quantity reduction, index 0..4 = level 1..5
  time: number[]; // time-reduction multiplier, index 0..4 = level 1..5
}

/** Item for the selector — a craftable item (derived from recipes). */
export interface CraftableItem {
  id: number;
  name: string;
  groupName: string;
  categoryName: string;
}

export interface GameData {
  craftables: CraftableItem[];
  recipeByItemId: Map<number, Recipe>;
  priceByItemId: Map<number, number>; // estimated_price
  iconByItemId: Map<number, number>; // itemId → iconId
  skillByName: Map<string, Skill>; // industry skills (efficiency/time)
  fetchedAt: number;
}

/** URL of the item's small icon on echoes.mobi. */
export function iconUrl(iconId: number | undefined): string | undefined {
  return iconId != null ? `https://echoes.mobi/public/icons/${iconId}.png` : undefined;
}
