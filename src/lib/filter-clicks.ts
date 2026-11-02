import { RECIPE_CLICK_DELAY } from "./recipe-clicks";

export function createFilterClicks(actions: { single: () => void; double: () => void }) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function cancel() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function click() {
    if (timer !== null) {
      cancel();
      actions.double();
    } else {
      timer = setTimeout(() => {
        timer = null;
        actions.single();
      }, RECIPE_CLICK_DELAY);
    }
  }

  return { click, cancel };
}
