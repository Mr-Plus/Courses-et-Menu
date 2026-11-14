/**
 * Composant Popup Liste de Courses & Menu de la semaine :
 * - Agrégation des ingrédients par rayon
 * - Fiches repas (toujours 8 cases minimum à l'impression PDF avec date de péremption manuelle)
 * - Impression PC / Génération PDF native iOS & WebApp
 * - Export IA & infobulles `popover="hint"` + `interestfor`
 */

import { CATEGORIES_META, MIN_PRINT_MEAL_SLOTS, formatQuantity } from "../constants.js";
import {
  generateMenuPdfBytes,
  generateShoppingListPdfBytes,
  isIosOrStandaloneWebApp,
  shareOrOpenPdfBytes
} from "../pdf-print.js";

export function openShoppingListPopup(dom) {
  if (
    dom.shoppingListDialog &&
    !dom.shoppingListDialog.open &&
    typeof dom.shoppingListDialog.showModal === "function"
  ) {
    dom.shoppingListDialog.showModal();
  }
}

export function aggregateIngredients(state) {
  const map = new Map();

  for (const dishId of state.selectedDishIds) {
    const dish = state.dishes.find((d) => d.id === dishId);
    if (!dish) continue;

    for (const ing of dish.ingredients) {
      if (!map.has(ing.key)) {
        map.set(ing.key, {
          key: ing.key,
          name: ing.name,
          totalQty: 0,
          unit: ing.unit,
          aisle: ing.aisle,
          usedInDishes: []
        });
      }
      const entry = map.get(ing.key);
      entry.totalQty += Number(ing.qty) || 0;
      entry.usedInDishes.push({
        dishId: dish.id,
        dishName: dish.name,
        category: dish.category,
        quantityForDish: `${ing.qty} ${ing.unit}`,
        rawNote: ing.detail
      });
    }
  }

  return Array.from(map.values());
}

export function buildAiShoppingJson(state) {
  const selectedDishes = Array.from(state.selectedDishIds)
    .map((id) => state.dishes.find((d) => d.id === id))
    .filter(Boolean);

  const aggregated = aggregateIngredients(state);

  return {
    schema: "https://menu-nutrition.app/schemas/ai-shopping-list-v1.json",
    generatedAt: new Date().toISOString(),
    targetDays: state.targetMeals,
    selectedMealsCount: selectedDishes.length,
    aiBrowserInstructions:
      "Utilise la liste `shoppingList` ci-dessous pour rechercher et ajouter automatiquement chaque ingrédient avec sa quantité totale (`formattedTotalQuantity`) dans le panier du site de courses ou Drive actif.",
    selectedMeals: selectedDishes.map((d) => ({
      id: d.id,
      name: d.name,
      nutritionCategory: d.category,
      nutritionScore: d.score,
      summary: d.rawDescription
    })),
    shoppingList: aggregated.map((item) => ({
      ingredientKey: item.key,
      name: item.name,
      totalQuantity: item.totalQty,
      unit: item.unit,
      formattedTotalQuantity: formatQuantity(item.totalQty, item.unit),
      aisleCategory: item.aisle,
      checked: state.checkedIngredients.has(item.key),
      usedInMeals: item.usedInDishes.map((u) => ({
        mealName: u.dishName,
        quantityNeeded: u.quantityForDish,
        recipeDetail: u.rawNote
      }))
    }))
  };
}

function buildBlankMealCardsHtml(blankCount) {
  if (blankCount <= 0) return "";
  const cards = Array.from({ length: blankCount }, () => `
    <li class="selected-meal-item is-blank-meal print-only" aria-hidden="true">
      <div class="selected-meal-top">
        <div class="meal-prepared-label">
          <input type="checkbox" class="meal-prepared-checkbox print-only" tabindex="-1">
          <span class="quota-cat-tag quota-cat-blank print-only">&nbsp;</span>
          <span class="selected-meal-name blank-meal-title-line"></span>
        </div>
      </div>
      <div class="meal-expiry-row print-only">
        <span class="meal-expiry-label">À cuisiner avant le :</span>
        <span class="meal-expiry-slots">__ / __ / __</span>
      </div>
      <ul class="selected-meal-ingredients print-only">
        <li><span class="blank-ingredient-line"></span></li>
        <li><span class="blank-ingredient-line"></span></li>
        <li><span class="blank-ingredient-line"></span></li>
        <li><span class="blank-ingredient-line"></span></li>
      </ul>
    </li>
  `).join("");

  return `
    <div class="meal-category-group print-only" aria-hidden="true">
      <ul class="aisle-items-list">
        ${cards}
      </ul>
    </div>
  `;
}

export function renderShoppingPopupContent(dom, state, savePersistedState) {
  const catOrder = ["A", "B", "C", "D"];
  const catRank = { A: 1, B: 2, C: 3, D: 4 };
  const selectedDishes = Array.from(state.selectedDishIds)
    .map((id) => state.dishes.find((d) => d.id === id))
    .filter(Boolean)
    .sort((a, b) => (catRank[a.category] || 99) - (catRank[b.category] || 99) || b.score - a.score);

  dom.selectedMealsCount.textContent = `${selectedDishes.length} plat${selectedDishes.length > 1 ? "s" : ""}`;
  const blankSlotsNeeded = Math.max(0, MIN_PRINT_MEAL_SLOTS - selectedDishes.length);

  const syncAi = () => {
    savePersistedState();
    const payload = buildAiShoppingJson(state);
    window.MENU_SHOPPING_LIST = payload;
    if (dom.aiScriptData) {
      dom.aiScriptData.textContent = JSON.stringify(payload, null, 2);
    }
  };

  if (selectedDishes.length === 0) {
    dom.shoppingStatusSubtitle.textContent =
      "Aucun plat sélectionné. Fermez cette fenêtre et cliquez sur des plats pour composer votre semaine.";
    dom.selectedMealsList.innerHTML = `
      <div class="empty-state-box no-print">
        Aucun plat sélectionné pour le moment.
      </div>
      ${buildBlankMealCardsHtml(blankSlotsNeeded)}
    `;
    dom.ingredientsTotalCount.textContent = "0 article";
    dom.ingredientsListContainer.innerHTML = `
      <div class="empty-state-box">
        Votre liste d'ingrédients apparaîtra automatiquement ici avec le cumul des quantités.
      </div>
    `;
    dom.tooltipsPortal.innerHTML = "";
    syncAi();
    return;
  }

  const aggregated = aggregateIngredients(state);
  const mealsLabel = `${selectedDishes.length} repas ${selectedDishes.length > 1 ? "sélectionnés" : "sélectionné"}`;
  const ingLabel = `${aggregated.length} ${aggregated.length > 1 ? "ingrédients agrégés" : "ingrédient agrégé"} par rayon`;
  dom.shoppingStatusSubtitle.innerHTML = `${mealsLabel}<br>${ingLabel}`;

  dom.selectedMealsList.innerHTML =
    catOrder
      .map((catCode) => {
        const dishesOfCat = selectedDishes.filter((d) => d.category === catCode);
        if (dishesOfCat.length === 0) return "";
        const meta = CATEGORIES_META[catCode];

        return `
          <div class="meal-category-group">
            <h4 class="aisle-group-title meal-cat-group-title no-print">
              <span class="nutri-grade-circle nutri-grade-xs ${meta.badgeClass}" aria-hidden="true">${catCode}</span>
              <span>${meta.title}</span>
            </h4>
            <ul class="aisle-items-list">
              ${dishesOfCat
                .map((dish) => {
                  const isPrepared = state.preparedDishIds.has(dish.id);
                  return `
                    <li class="selected-meal-item ${isPrepared ? "is-prepared" : ""}">
                      <div class="selected-meal-top">
                        <label class="meal-prepared-label">
                          <input
                            type="checkbox"
                            class="meal-prepared-checkbox print-only"
                            data-prepared-dish="${dish.id}"
                            ${isPrepared ? "checked" : ""}
                          >
                          <span class="quota-cat-tag ${meta.quotaTagClass} print-only">${dish.category}</span>
                          <span class="selected-meal-name">${dish.name}</span>
                        </label>
                        <button
                          type="button"
                          class="btn-remove-meal no-print"
                          data-remove-dish="${dish.id}"
                          aria-label="Retirer ${dish.name} du menu"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-xs" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                      <div class="meal-expiry-row print-only">
                        <span class="meal-expiry-label">À cuisiner avant le :</span>
                        <span class="meal-expiry-slots">__ / __ / __</span>
                      </div>
                      <ul class="selected-meal-ingredients print-only">
                        ${dish.ingredients.map((ing) => `<li>${ing.detail}</li>`).join("")}
                      </ul>
                    </li>
                  `;
                })
                .join("")}
            </ul>
          </div>
        `;
      })
      .join("") + buildBlankMealCardsHtml(blankSlotsNeeded);

  dom.ingredientsTotalCount.textContent = `${aggregated.length} ingrédient${aggregated.length > 1 ? "s" : ""}`;

  const byAisle = new Map();
  for (const item of aggregated) {
    if (!byAisle.has(item.aisle)) byAisle.set(item.aisle, []);
    byAisle.get(item.aisle).push(item);
  }

  let groupsHtml = "";
  let tooltipsHtml = "";

  for (const [aisle, items] of byAisle.entries()) {
    groupsHtml += `
      <div class="aisle-group">
        <h4 class="aisle-group-title">${aisle}</h4>
        <ul class="aisle-items-list">
          ${items
            .map((item) => {
              const isChecked = state.checkedIngredients.has(item.key);
              const tooltipId = `tooltip-ing-${item.key}`;
              const anchorVar = `--anchor-ing-${item.key}`;
              const dishCount = item.usedInDishes.length;

              tooltipsHtml += `
                <div
                  popover="hint"
                  id="${tooltipId}"
                  class="ingredient-tooltip-popover"
                  style="--anchor-id: ${anchorVar};"
                >
                  <span class="tooltip-title">${item.name} (${formatQuantity(item.totalQty, item.unit)})</span>
                  <ul class="tooltip-dishes-list">
                    ${item.usedInDishes
                      .map((u) => `<li><strong>${u.dishName}</strong> : ${u.rawNote}</li>`)
                      .join("")}
                  </ul>
                </div>
              `;

              return `
                <li class="ingredient-row ${isChecked ? "is-checked" : ""}">
                  <label class="ingredient-label-wrap">
                    <input
                      type="checkbox"
                      class="ingredient-checkbox no-print"
                      data-ing-key="${item.key}"
                      ${isChecked ? "checked" : ""}
                    >
                    <span class="ingredient-name-qty">
                      <span>${item.name} : </span>
                      <strong class="ingredient-qty-strong">${formatQuantity(item.totalQty, item.unit)}</strong>
                    </span>
                  </label>

                  <button
                    type="button"
                    class="ingredient-dish-trigger no-print"
                    interestfor="${tooltipId}"
                    style="--anchor-id: ${anchorVar};"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-xs" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                    </svg>
                    <span>${dishCount} plat${dishCount > 1 ? "s" : ""}</span>
                  </button>
                </li>
              `;
            })
            .join("")}
        </ul>
      </div>
    `;
  }

  dom.ingredientsListContainer.innerHTML = groupsHtml;
  dom.tooltipsPortal.innerHTML = tooltipsHtml;

  const dateStr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date());
  dom.printDateSummary.textContent = `Généré le ${dateStr} • ${selectedDishes.length} repas sélectionnés (${aggregated.length} ingrédients au total)`;

  syncAi();
}

export function initShoppingDialogEvents(dom, state, { onStateChange, onPopupContentChange }) {
  dom.selectedMealsList.addEventListener("click", (e) => {
    const removeBtn = e.target.closest("[data-remove-dish]");
    if (!removeBtn) return;
    const id = removeBtn.dataset.removeDish;
    state.selectedDishIds.delete(id);
    state.preparedDishIds.delete(id);
    onStateChange();
  });

  dom.selectedMealsList.addEventListener("change", (e) => {
    const checkbox = e.target.closest("[data-prepared-dish]");
    if (!checkbox) return;
    const id = checkbox.dataset.preparedDish;
    if (checkbox.checked) {
      state.preparedDishIds.add(id);
    } else {
      state.preparedDishIds.delete(id);
    }
    onPopupContentChange();
  });

  dom.ingredientsListContainer.addEventListener("change", (e) => {
    const checkbox = e.target.closest(".ingredient-checkbox");
    if (!checkbox) return;
    const key = checkbox.dataset.ingKey;
    if (checkbox.checked) {
      state.checkedIngredients.add(key);
    } else {
      state.checkedIngredients.delete(key);
    }
    onPopupContentChange();
  });

  dom.btnPrintShopping.addEventListener("click", () => {
    document.body.dataset.printMode = "shopping";
    if (dom.printDocumentTitle) {
      dom.printDocumentTitle.textContent = "Liste de Courses de la Semaine (par rayon)";
    }
    if (isIosOrStandaloneWebApp()) {
      const dateStr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date());
      const pdfBytes = generateShoppingListPdfBytes({
        aggregatedIngredients: aggregateIngredients(state),
        checkedIngredients: state.checkedIngredients,
        selectedMealsCount: state.selectedDishIds.size,
        formatQuantity,
        dateStr
      });
      shareOrOpenPdfBytes(pdfBytes, "Liste-de-Courses.pdf", "Liste de Courses de la Semaine");
      return;
    }
    window.print();
  });

  dom.btnPrintMenu.addEventListener("click", () => {
    document.body.dataset.printMode = "menu";
    if (dom.printDocumentTitle) {
      dom.printDocumentTitle.textContent = "Menu de la Semaine & Fiches Ingrédients";
    }
    if (isIosOrStandaloneWebApp()) {
      const catRank = { A: 1, B: 2, C: 3, D: 4 };
      const selectedDishes = Array.from(state.selectedDishIds)
        .map((id) => state.dishes.find((d) => d.id === id))
        .filter(Boolean)
        .sort((a, b) => (catRank[a.category] || 99) - (catRank[b.category] || 99) || b.score - a.score);
      const dateStr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date());
      const pdfBytes = generateMenuPdfBytes({
        selectedDishes,
        preparedDishIds: state.preparedDishIds,
        totalIngredientsCount: aggregateIngredients(state).length,
        dateStr
      });
      shareOrOpenPdfBytes(pdfBytes, "Menu-de-la-Semaine.pdf", "Menu de la Semaine & Fiches Ingrédients");
      return;
    }
    window.print();
  });

  dom.btnCopyAiPrompt.addEventListener("click", async () => {
    const payload = buildAiShoppingJson(state);
    const promptText = [
      "Voici ma liste de courses générée depuis Courses & Menu.",
      "Parcours chaque article de `shoppingList` et ajoute-le automatiquement à mon panier de courses en ligne avec la quantité indiquée dans `formattedTotalQuantity` :",
      "",
      JSON.stringify(payload, null, 2)
    ].join("\n");

    await navigator.clipboard.writeText(promptText);
    dom.copyPromptLabel.textContent = "Copié !";
    dom.btnCopyAiPrompt.classList.add("is-copied");
    dom.btnCopyAiPrompt.title = "Copié dans le presse-papier !";
    setTimeout(() => {
      dom.copyPromptLabel.textContent = "Export pour IA";
      dom.btnCopyAiPrompt.classList.remove("is-copied");
      dom.btnCopyAiPrompt.title = "Copier les instructions d'auto-remplissage Drive par IA";
    }, 2000);
  });

  dom.shoppingListDialog.addEventListener("close", () => {
    dom.shoppingListDialog.returnValue = "";
  });

  // Fallback autonome pour `command="show-modal"`
  document.addEventListener("click", (e) => {
    const invoker = e.target.closest('[command="show-modal"][commandfor]');
    if (!invoker) return;
    const targetDialog = document.getElementById(invoker.getAttribute("commandfor"));
    if (targetDialog && !targetDialog.open && typeof targetDialog.showModal === "function") {
      targetDialog.showModal();
    }
  });

  // Support tactile & fallback PC pour `interestfor`
  let activeTouchTrigger = null;
  const getPopoverForTrigger = (trigger) => {
    const targetId = trigger?.getAttribute("interestfor");
    return targetId ? document.getElementById(targetId) : null;
  };

  const positionAndShowHint = (trigger) => {
    const popoverEl = getPopoverForTrigger(trigger);
    if (!popoverEl) return;

    if (!("anchorName" in document.documentElement.style)) {
      const rect = trigger.getBoundingClientRect();
      const popoverW = Math.min(320, window.innerWidth - 32);
      popoverEl.style.position = "fixed";
      popoverEl.style.top = `${Math.min(window.innerHeight - 140, rect.bottom + 6)}px`;
      popoverEl.style.left = `${Math.max(16, Math.min(window.innerWidth - popoverW - 16, rect.right - popoverW))}px`;
    }

    if (typeof popoverEl.showPopover === "function") {
      try {
        popoverEl.showPopover();
      } catch {
        popoverEl.classList.add(":popover-open");
      }
    } else {
      popoverEl.classList.add(":popover-open");
    }
  };

  const hideHint = (trigger) => {
    const popoverEl = getPopoverForTrigger(trigger);
    if (!popoverEl) return;

    if (typeof popoverEl.hidePopover === "function") {
      try {
        popoverEl.hidePopover();
      } catch {
        popoverEl.classList.remove(":popover-open");
      }
    } else {
      popoverEl.classList.remove(":popover-open");
    }
  };

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[interestfor]");
    if (!trigger) {
      if (activeTouchTrigger) {
        hideHint(activeTouchTrigger);
        activeTouchTrigger = null;
      }
      return;
    }
    if (activeTouchTrigger === trigger) {
      hideHint(trigger);
      activeTouchTrigger = null;
    } else {
      if (activeTouchTrigger) hideHint(activeTouchTrigger);
      positionAndShowHint(trigger);
      activeTouchTrigger = trigger;
    }
  });

  if (!HTMLButtonElement.prototype.hasOwnProperty("interestForElement")) {
    document.addEventListener("mouseover", (e) => {
      const trigger = e.target.closest("[interestfor]");
      if (trigger) positionAndShowHint(trigger);
    });
    document.addEventListener("mouseout", (e) => {
      const trigger = e.target.closest("[interestfor]");
      if (trigger && !trigger.contains(e.relatedTarget) && activeTouchTrigger !== trigger) {
        hideHint(trigger);
      }
    });
    document.addEventListener("focusin", (e) => {
      const trigger = e.target.closest("[interestfor]");
      if (trigger) positionAndShowHint(trigger);
    });
    document.addEventListener("focusout", (e) => {
      const trigger = e.target.closest("[interestfor]");
      if (trigger && activeTouchTrigger !== trigger) hideHint(trigger);
    });
  }

  if (!("closedBy" in HTMLDialogElement.prototype)) {
    const outside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
      let pressedOutside = false;
      dialog.addEventListener("pointerdown", (e) => {
        pressedOutside = outside(e, dialog);
      });
      dialog.addEventListener("pointerup", (e) => {
        if (pressedOutside && outside(e, dialog)) dialog.close();
      });
    }
  }
}
