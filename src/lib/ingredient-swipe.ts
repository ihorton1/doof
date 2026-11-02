export function ingredientSwipeOffset(dx: number, dy: number): number {
  return dx <= -12 && Math.abs(dx) > Math.abs(dy) * 1.5 ? dx : 0;
}

export function isIngredientRemovalSwipe(dx: number, dy: number): boolean {
  return ingredientSwipeOffset(dx, dy) <= -80;
}
