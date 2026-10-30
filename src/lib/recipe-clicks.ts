export const RECIPE_CLICK_DELAY = 400;

export function createRecipeClicks<T extends { id: string }>(actions: {
  single: (value: T) => void;
  double: (value: T) => void;
  triple: (value: T) => void;
}) {
  let pending: { id: string; count: number; timer: ReturnType<typeof setTimeout> } | null = null;

  function cancel() {
    if (pending) clearTimeout(pending.timer);
    pending = null;
  }

  function click(value: T) {
    const count = pending?.id === value.id ? pending.count + 1 : 1;
    cancel();
    if (count === 3) {
      actions.triple(value);
      return;
    }
    pending = {
      id: value.id,
      count,
      timer: setTimeout(() => {
        pending = null;
        if (count === 1) actions.single(value);
        else actions.double(value);
      }, RECIPE_CLICK_DELAY),
    };
  }

  return { click, cancel };
}
