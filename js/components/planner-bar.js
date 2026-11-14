/**
 * Composant barre de planification compacte :
 * - Stepper [-] N plats [+] et raccourcis rapides (2, 3, 4, 5, 7)
 * - Bouton Suggestion équilibrée
 * - Bouton Quotas (affiche les détails au clic + interrupteur Activer/Désactiver
 *   + ajustement manuel du nombre de plats par lettre si décoché)
 */

import { CATEGORIES_META, getEffectiveQuotas } from "../constants.js";

const QUOTA_DESCRIPTIONS = {
  A: () => "À volonté",
  B: (max) => (Number.isFinite(max) ? `Max ${max} plat${max > 1 ? "s" : ""} équilibré${max > 1 ? "s" : ""}` : "Illimité"),
  C: (max) =>
    max === 0 ? "Pour 1 repas, privilégiez A/B" : Number.isFinite(max) ? `${max} plat${max > 1 ? "s" : ""} modéré${max > 1 ? "s" : ""} max` : "Illimité",
  D: (max) =>
    max === 0 ? "Aucun plat riche pour 1 repas" : Number.isFinite(max) ? `${max} plat${max > 1 ? "s" : ""} gourmand${max > 1 ? "s" : ""} max` : "Illimité"
};

export function renderPlannerBar(dom, state) {
  if (dom.customDaysValue) {
    dom.customDaysValue.textContent = `${state.targetMeals} plat${state.targetMeals > 1 ? "s" : ""}`;
  }

  if (dom.customPeopleValue) {
    dom.customPeopleValue.textContent = `${state.peopleCount} pers.`;
  }

  if (dom.strictModeCheckbox) {
    dom.strictModeCheckbox.checked = state.strictQuotas;
  }

  if (dom.quotasTriggerLabel) {
    dom.quotasTriggerLabel.textContent = state.strictQuotas ? "Quotas : Oui" : "Quotas : Perso";
  }

  if (dom.btnQuotasDetails) {
    dom.btnQuotasDetails.classList.toggle("is-active", state.strictQuotas);
  }

  if (dom.quotasDetailsMeals) {
    dom.quotasDetailsMeals.textContent = `${state.targetMeals} plat${state.targetMeals > 1 ? "s" : ""}`;
  }

  if (dom.quotasDetailsGrid) {
    const quotas = getEffectiveQuotas(state);
    const isCustom = !state.strictQuotas;

    dom.quotasDetailsGrid.innerHTML = ["A", "B", "C", "D"]
      .map((code) => {
        const meta = CATEGORIES_META[code];
        const maxVal = quotas[code].max;
        const label = Number.isFinite(maxVal) ? (maxVal === 0 ? "0 max" : `Max ${maxVal}`) : "Illimité";
        const shortVal = Number.isFinite(maxVal) ? String(maxVal) : "∞";
        const desc = QUOTA_DESCRIPTIONS[code](maxVal);

        return `
          <div class="quota-detail-chip ${isCustom ? "is-editable" : ""}">
            <div class="quota-detail-top">
              <span class="quota-cat-tag ${meta.quotaTagClass}">Cat. ${code}</span>
              ${isCustom ? "" : `<strong>${label}</strong>`}
            </div>
            ${
              isCustom
                ? `
                  <div class="quota-custom-stepper" role="group" aria-label="Ajuster le maximum pour la catégorie ${code}">
                    <button type="button" class="quota-step-btn" data-quota-cat="${code}" data-quota-delta="-1" aria-label="Diminuer Catégorie ${code}">−</button>
                    <span class="quota-step-val">${shortVal}</span>
                    <button type="button" class="quota-step-btn" data-quota-cat="${code}" data-quota-delta="1" aria-label="Augmenter Catégorie ${code}">+</button>
                  </div>
                `
                : `<span class="quota-detail-desc">${desc}</span>`
            }
          </div>
        `;
      })
      .join("");
  }

  if (dom.quotaAlertBanner) {
    dom.quotaAlertBanner.hidden = !state.quotaAlertMessage;
    if (state.quotaAlertMessage) {
      dom.quotaAlertBanner.textContent = state.quotaAlertMessage;
    }
  }
}

export function initPlannerBarEvents(dom, state, { onStateChange, onAutoSuggest }) {
  dom.btnDaysMinus.addEventListener("click", () => {
    if (state.targetMeals > 1) {
      state.targetMeals--;
      state.quotaAlertMessage = "";
      onStateChange();
    }
  });

  dom.btnDaysPlus.addEventListener("click", () => {
    const maxMeals = Math.max(21, state.dishes.length);
    if (state.targetMeals < maxMeals) {
      state.targetMeals++;
      state.quotaAlertMessage = "";
      onStateChange();
    }
  });

  if (dom.btnPeopleMinus) {
    dom.btnPeopleMinus.addEventListener("click", () => {
      if (state.peopleCount > 1) {
        state.peopleCount--;
        onStateChange();
      }
    });
  }

  if (dom.btnPeoplePlus) {
    dom.btnPeoplePlus.addEventListener("click", () => {
      if (state.peopleCount < 12) {
        state.peopleCount++;
        onStateChange();
      }
    });
  }

  if (dom.btnQuotasDetails && dom.quotasDetailsPanel) {
    dom.btnQuotasDetails.addEventListener("click", () => {
      const willOpen = dom.quotasDetailsPanel.hidden;
      dom.quotasDetailsPanel.hidden = !willOpen;
      dom.btnQuotasDetails.setAttribute("aria-expanded", String(willOpen));
    });
  }

  dom.strictModeCheckbox.addEventListener("change", (e) => {
    state.strictQuotas = e.target.checked;
    state.quotaAlertMessage = "";
    onStateChange();
  });

  if (dom.quotasDetailsGrid) {
    dom.quotasDetailsGrid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-quota-cat]");
      if (!btn || state.strictQuotas) return;

      const cat = btn.dataset.quotaCat;
      const delta = Number(btn.dataset.quotaDelta);
      const current = state.customQuotas[cat];

      if (delta < 0) {
        if (current === null) {
          state.customQuotas[cat] = Math.max(1, state.targetMeals);
        } else if (current > 0) {
          state.customQuotas[cat] = current - 1;
        }
      } else if (delta > 0) {
        if (current === null) return;
        if (current >= 10) {
          state.customQuotas[cat] = null; // Passe à Illimité (∞)
        } else {
          state.customQuotas[cat] = current + 1;
        }
      }

      onStateChange();
    });
  }

  dom.btnAutoSuggest.addEventListener("click", () => {
    state.quotaAlertMessage = "";
    onAutoSuggest();
  });
}
