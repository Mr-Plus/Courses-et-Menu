/**
 * Composant Barre inférieure 100 % pleine largeur :
 * Affiche le compteur de plats, les pastilles A/B/C/D, le bouton Tout vider et Voir la liste.
 */

import { getEffectiveQuotas } from "../constants.js";

export function renderBottomBar(dom, state, getSelectedCountsByCategory) {
  const quotas = getEffectiveQuotas(state);
  const counts = getSelectedCountsByCategory();
  const totalSelected = state.selectedDishIds.size;

  if (dom.bottomBarCount) {
    dom.bottomBarCount.textContent = `${totalSelected} / ${state.targetMeals} plat${state.targetMeals > 1 ? "s" : ""}`;
    dom.bottomBarCount.classList.toggle("is-complete", totalSelected >= state.targetMeals);
  }

  if (dom.bottomBarQuotas) {
    const infinitySvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="icon-infinity-xs" aria-hidden="true"><path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z"/></svg>`;
    dom.bottomBarQuotas.innerHTML = ["A", "B", "C", "D"]
      .map((catCode) => {
        const q = quotas[catCode];
        const current = counts[catCode];
        const maxLabel = Number.isFinite(q.max) ? `/${q.max}` : `/${infinitySvg}`;
        const isAtMax = Number.isFinite(q.max) && q.max > 0 && current === q.max;
        const isOver = Number.isFinite(q.max) && current > q.max;
        return `
          <span
            class="bottom-cat-pill bottom-cat-${catCode.toLowerCase()} ${isAtMax ? "is-at-max" : ""} ${isOver ? "is-over" : ""}"
            title="Catégorie ${catCode} : ${current} sélectionné${current > 1 ? "s" : ""}"
          >
            <strong class="bottom-cat-letter">${catCode}</strong>
            <span class="bottom-cat-ratio">${current}${maxLabel}</span>
          </span>
        `;
      })
      .join("");
  }

  if (dom.btnClearSelection) {
    dom.btnClearSelection.hidden = totalSelected === 0;
  }
}

export function initBottomBarEvents(dom, state, { onClear }) {
  if (dom.btnClearSelection) {
    dom.btnClearSelection.addEventListener("click", () => {
      state.selectedDishIds.clear();
      state.preparedDishIds.clear();
      state.checkedIngredients.clear();
      state.quotaAlertMessage = "";
      onClear();
    });
  }
}
