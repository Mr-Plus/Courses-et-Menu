/**
 * Composant Catalogue :
 * - Barre sticky de recherche + filtres compacts (Toutes, A, B, C, D)
 * - Grille des plats groupés par note nutritionnelle (sans liste d'ingrédients dans les cartes)
 */

import { CATEGORIES_META, getEffectiveQuotas } from "../constants.js";

export function renderCatalog(dom, state, getSelectedCountsByCategory) {
  const quotas = getEffectiveQuotas(state);
  const counts = getSelectedCountsByCategory();
  const query = state.searchQuery.trim().toLowerCase();

  if (dom.totalDishesCount) dom.totalDishesCount.textContent = String(state.dishes.length);

  const categoriesOrder = ["A", "B", "C", "D"];
  let html = "";

  for (const catCode of categoriesOrder) {
    if (state.activeFilter !== "ALL" && state.activeFilter !== catCode) continue;

    const dishesInCat = state.dishes.filter((dish) => {
      if (dish.category !== catCode) return false;
      if (!query) return true;
      return (
        dish.name.toLowerCase().includes(query) ||
        dish.rawDescription.toLowerCase().includes(query) ||
        (dish.nutritionHighlight && dish.nutritionHighlight.toLowerCase().includes(query))
      );
    });

    if (dishesInCat.length === 0) continue;

    const meta = CATEGORIES_META[catCode];
    const q = quotas[catCode];
    const current = counts[catCode];
    const isUnlimited = !Number.isFinite(q.max);
    const isCategoryFull = !isUnlimited && current >= q.max;

    const infinitySvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="icon-xs" aria-hidden="true"><path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z"/></svg>`;
    const quotaPillHtml = isUnlimited
      ? `${current} / ${infinitySvg}`
      : `${current} / ${q.max}`;
    const quotaAriaLabel = isUnlimited
      ? `${current} sélectionné${current > 1 ? "s" : ""}, illimité`
      : `${current} sur ${q.max} max conseillé`;

    html += `
      <section class="category-section category-section-${catCode.toLowerCase()}" aria-labelledby="cat-heading-${catCode}">
        <div class="category-section-inner container">
          <div class="category-banner">
            <div class="category-banner-left">
              <div class="nutri-grade-circle ${meta.badgeClass}" aria-hidden="true">${catCode}</div>
              <div>
                <h2 id="cat-heading-${catCode}">${meta.title}</h2>
                <p>${meta.subtitle}</p>
              </div>
            </div>
            <span class="category-quota-pill ${meta.quotaTagClass}" aria-label="${quotaAriaLabel}">${quotaPillHtml}</span>
          </div>

          <div class="dishes-grid">
            ${dishesInCat
              .map((dish) => {
                const isSelected = state.selectedDishIds.has(dish.id);
                const isLocked = state.strictQuotas && !isSelected && isCategoryFull;

                return `
                  <button
                    type="button"
                    class="dish-card ${isSelected ? "is-selected" : ""} ${isLocked ? "is-quota-locked" : ""}"
                    data-dish-id="${dish.id}"
                    aria-pressed="${isSelected}"
                  >
                    <div>
                      <div class="dish-card-header">
                        <span class="dish-title">${dish.name}</span>
                        <span class="dish-score-pill ${meta.quotaTagClass}">Note ${dish.score}/100</span>
                      </div>

                      <div class="dish-macros">
                        <span class="macro-chip">Protéines : ${dish.proteinLevel}</span>
                        <span class="macro-chip">${dish.fatSugarNote}</span>
                      </div>
                    </div>
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>
      </section>
    `;
  }

  if (!html) {
    html = `
      <div class="container">
        <div class="empty-state-box">
          Aucun plat ne correspond à votre recherche « ${state.searchQuery} ».
        </div>
      </div>
    `;
  }

  dom.dishesCategoriesContainer.innerHTML = html;
}

export function initCatalogEvents(
  dom,
  state,
  { getSelectedCountsByCategory, onDishToggled, onFilterChange }
) {
  dom.dishSearchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    onFilterChange();
  });

  if (dom.categoryFilterTrigger && dom.categoryFilterMenu) {
    const closeMenu = () => {
      dom.categoryFilterMenu.hidden = true;
      dom.categoryFilterTrigger.setAttribute("aria-expanded", "false");
    };

    const updateTriggerUi = (filterVal) => {
      dom.categoryFilterTrigger.classList.remove(
        "is-filtered-a",
        "is-filtered-b",
        "is-filtered-c",
        "is-filtered-d"
      );
      if (filterVal === "ALL") {
        dom.categoryTriggerIndicator.innerHTML = `
          <span class="mini-dots-grid">
            <span class="dot-a"></span><span class="dot-b"></span>
            <span class="dot-c"></span><span class="dot-d"></span>
          </span>`;
        dom.categoryTriggerLabel.textContent = "Catégories";
      } else {
        const lower = filterVal.toLowerCase();
        dom.categoryFilterTrigger.classList.add(`is-filtered-${lower}`);
        dom.categoryTriggerIndicator.innerHTML = `<span class="cat-badge-xs grade-${lower}">${filterVal}</span>`;
        dom.categoryTriggerLabel.textContent = `Cat. ${filterVal}`;
      }

      dom.categoryFilterOptions.forEach((opt) => {
        const isSelected = opt.dataset.filter === filterVal;
        opt.classList.toggle("is-selected", isSelected);
        opt.setAttribute("aria-selected", String(isSelected));
      });
    };

    dom.categoryFilterTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = !dom.categoryFilterMenu.hidden;
      dom.categoryFilterMenu.hidden = isOpen;
      dom.categoryFilterTrigger.setAttribute("aria-expanded", String(!isOpen));
    });

    dom.categoryFilterOptions.forEach((opt) => {
      opt.addEventListener("click", () => {
        const val = opt.dataset.filter;
        state.activeFilter = val;
        updateTriggerUi(val);
        closeMenu();
        onFilterChange();
      });
    });

    document.addEventListener("click", (e) => {
      if (!dom.categoryFilterMenu.hidden && !dom.categoryFilterDropdown.contains(e.target)) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !dom.categoryFilterMenu.hidden) {
        closeMenu();
        dom.categoryFilterTrigger.focus();
      }
    });
  }

  dom.dishesCategoriesContainer.addEventListener("click", (e) => {
    const card = e.target.closest(".dish-card");
    if (!card) return;

    const dishId = card.dataset.dishId;
    const dish = state.dishes.find((d) => d.id === dishId);
    if (!dish) return;

    if (state.selectedDishIds.has(dishId)) {
      state.selectedDishIds.delete(dishId);
      state.quotaAlertMessage = "";
      onDishToggled(false);
      return;
    }

    if (state.strictQuotas) {
      const quotas = getEffectiveQuotas(state);
      const counts = getSelectedCountsByCategory();
      const maxAllowed = quotas[dish.category].max;

      if (counts[dish.category] >= maxAllowed) {
        state.quotaAlertMessage =
          `Quota atteint pour la Catégorie ${dish.category} (${maxAllowed} max conseillé). ` +
          `Choisissez un plat Cat. A ou B, ou décochez « Quotas ».`;
        onFilterChange(true);
        return;
      }
    }

    state.quotaAlertMessage = "";
    state.selectedDishIds.add(dishId);
    onDishToggled(state.selectedDishIds.size === state.targetMeals);
  });
}
