// Нормалізовані доменні типи (після парсингу string→number з API).

export interface Material {
  id: number;
  name: string;
  type: string;
  quantity: number;
}

export type RecipeKind = "manufacture" | "reverse";

/**
 * Рецепт виробництва предмета. Два джерела рецептів (виробництво та реверс-
 * інжиніринг) не перетинаються — кожен предмет має максимум один рецепт.
 */
export interface Recipe {
  itemId: number;
  blueprintId: number; // власний id рецепту-блюпрінта (для ціни блюпрінта)
  name: string;
  categoryName: string;
  groupName: string;
  kind: RecipeKind;
  outputNumber: number;
  manufactureCost: number;
  manufactureTime: number; // секунди
  passRate: number; // ймовірність успіху (1 для виробництва, <1 для реверсу)
  skills: string[]; // назви релевантних скілів
  materials: Material[];
}

export interface Skill {
  name: string;
  efficiency: number[]; // % зниження кількості, індекс 0..4 = рівень 1..5
  time: number[]; // множник зниження часу, індекс 0..4 = рівень 1..5
}

/** Елемент для селектора — craftable-предмет (виводиться з рецептів). */
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
  skillByName: Map<string, Skill>; // індустрі-скіли (efficiency/time)
  fetchedAt: number;
}

/** URL маленької іконки предмета на echoes.mobi. */
export function iconUrl(iconId: number | undefined): string | undefined {
  return iconId != null ? `https://echoes.mobi/public/icons/${iconId}.png` : undefined;
}
