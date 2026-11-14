/**
 * Point d'entrée de Courses & Menu :
 * Orchestre l'état global, le chargement de `data/recipes.json`, la persistance locale
 * et les composants de l'interface.
 */

import { STORAGE_KEY, getEffectiveQuotas, normalizeRecipe } from "./constants.js";
import { initPlannerBarEvents, renderPlannerBar } from "./components/planner-bar.js";
import { initCatalogEvents, renderCatalog } from "./components/catalog.js";
import { initBottomBarEvents, renderBottomBar } from "./components/bottom-bar.js";
import {
  initShoppingDialogEvents,
  openShoppingListPopup,
  renderShoppingPopupContent
} from "./components/shopping-dialog.js";
import { initPwaInstall } from "./components/pwa-install.js";

const state = {
  targetMeals: 4,
  peopleCount: 2,
  strictQuotas: true,
  customQuotas: { A: null, B: 3, C: 1, D: 1 },
  activeFilter: "ALL",
  searchQuery: "",
  quotaAlertMessage: "",
  dishes: [],
  selectedDishIds: new Set([
    "soupe-butternut",
    "petit-sale",
    "salade-chevre-chaud",
    "raclette"
  ]),
  preparedDishIds: new Set(),
  checkedIngredients: new Set()
};

const dom = {
  bottomBarCount: document.getElementById("bottom-bar-count"),
  bottomBarQuotas: document.getElementById("bottom-bar-quotas"),
  customDaysValue: document.getElementById("custom-days-value"),
  btnDaysMinus: document.getElementById("btn-days-minus"),
  btnDaysPlus: document.getElementById("btn-days-plus"),
  customPeopleValue: document.getElementById("custom-people-value"),
  btnPeopleMinus: document.getElementById("btn-people-minus"),
  btnPeoplePlus: document.getElementById("btn-people-plus"),
  strictModeCheckbox: document.getElementById("strict-mode-checkbox"),
  btnQuotasDetails: document.getElementById("btn-quotas-details"),
  quotasTriggerLabel: document.getElementById("quotas-trigger-label"),
  quotasDetailsPanel: document.getElementById("quotas-details-panel"),
  quotasDetailsMeals: document.getElementById("quotas-details-meals"),
  quotasDetailsGrid: document.getElementById("quotas-details-grid"),
  quotaAlertBanner: document.getElementById("quota-alert-banner"),
  totalDishesCount: document.getElementById("total-dishes-count"),
  dishesCategoriesContainer: document.getElementById("dishes-categories-container"),
  dishSearchInput: document.getElementById("dish-search"),
  categoryFilterDropdown: document.getElementById("category-filter-dropdown"),
  categoryFilterTrigger: document.getElementById("category-filter-trigger"),
  categoryTriggerIndicator: document.getElementById("category-trigger-indicator"),
  categoryTriggerLabel: document.getElementById("category-trigger-label"),
  categoryFilterMenu: document.getElementById("category-filter-menu"),
  categoryFilterOptions: document.querySelectorAll(".category-dropdown-option"),
  selectedMealsCount: document.getElementById("selected-meals-count"),
  selectedMealsList: document.getElementById("selected-meals-list"),
  shoppingStatusSubtitle: document.getElementById("shopping-status-subtitle"),
  btnClearSelection: document.getElementById("btn-clear-selection"),
  ingredientsTotalCount: document.getElementById("ingredients-total-count"),
  ingredientsListContainer: document.getElementById("ingredients-list-container"),
  tooltipsPortal: document.getElementById("tooltips-portal"),
  btnAutoSuggest: document.getElementById("btn-auto-suggest"),
  btnPrintShopping: document.getElementById("btn-print-shopping"),
  btnPrintMenu: document.getElementById("btn-print-menu"),
  printDocumentTitle: document.getElementById("print-document-title"),
  printDateSummary: document.getElementById("print-date-summary"),
  shoppingListDialog: document.getElementById("shopping-list-dialog"),
  pwaInstallDialog: document.getElementById("pwa-install-dialog"),
  btnInstallApp: document.getElementById("btn-install-app"),
  aiScriptData: document.getElementById("ai-shopping-list-data"),
  btnCopyAiPrompt: document.getElementById("btn-copy-ai-prompt"),
  copyPromptLabel: document.getElementById("copy-prompt-label")
};

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Number.isFinite(Number(saved.targetMeals)) && saved.targetMeals >= 1) {
      state.targetMeals = Number(saved.targetMeals);
    }
    if (Number.isFinite(Number(saved.peopleCount)) && saved.peopleCount >= 1) {
      state.peopleCount = Number(saved.peopleCount);
    }
    if (typeof saved.strictQuotas === "boolean") {
      state.strictQuotas = saved.strictQuotas;
    }
    if (saved.customQuotas && typeof saved.customQuotas === "object") {
      state.customQuotas = {
        A: saved.customQuotas.A === undefined ? null : saved.customQuotas.A,
        B: saved.customQuotas.B === undefined ? 3 : saved.customQuotas.B,
        C: saved.customQuotas.C === undefined ? 1 : saved.customQuotas.C,
        D: saved.customQuotas.D === undefined ? 1 : saved.customQuotas.D
      };
    }
    if (Array.isArray(saved.selectedDishIds)) {
      state.selectedDishIds = new Set(saved.selectedDishIds);
    }
    if (Array.isArray(saved.preparedDishIds)) {
      state.preparedDishIds = new Set(saved.preparedDishIds);
    }
    if (Array.isArray(saved.checkedIngredients)) {
      state.checkedIngredients = new Set(saved.checkedIngredients);
    }
  } catch {
    // Ignore erreurs de lecture localStorage
  }
}

function savePersistedState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        targetMeals: state.targetMeals,
        peopleCount: state.peopleCount,
        strictQuotas: state.strictQuotas,
        customQuotas: state.customQuotas,
        selectedDishIds: Array.from(state.selectedDishIds),
        preparedDishIds: Array.from(state.preparedDishIds),
        checkedIngredients: Array.from(state.checkedIngredients)
      })
    );
  } catch {
    // Ignore erreurs d'écriture localStorage
  }
}

function getSelectedCountsByCategory() {
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  for (const id of state.selectedDishIds) {
    const dish = state.dishes.find((d) => d.id === id);
    if (dish) counts[dish.category]++;
  }
  return counts;
}

function renderAll() {
  savePersistedState();
  renderPlannerBar(dom, state);
  renderBottomBar(dom, state, getSelectedCountsByCategory);
  renderCatalog(dom, state, getSelectedCountsByCategory);
  renderShoppingPopupContent(dom, state, savePersistedState);
}

function autoSuggestBalancedMenu() {
  const target = state.targetMeals;
  const quotas = getEffectiveQuotas(state);
  const pickRandom = (arr, count) => [...arr].sort(() => Math.random() - 0.5).slice(0, count);

  const dishesA = state.dishes.filter((d) => d.category === "A");
  const dishesB = state.dishes.filter((d) => d.category === "B");
  const dishesC = state.dishes.filter((d) => d.category === "C");
  const dishesD = state.dishes.filter((d) => d.category === "D");

  const chosen = [];

  if (target === 1) {
    chosen.push(...pickRandom(dishesA, 1));
  } else if (target === 2) {
    chosen.push(...pickRandom(dishesB, 1));
    chosen.push(...pickRandom(dishesA, 1));
  } else {
    const countD = Math.min(1, quotas.D.max);
    const countC = Math.min(target >= 4 ? 1 : 0, quotas.C.max);
    const remaining = target - countD - countC;
    const countB = Math.floor(remaining / 2);
    const countA = Math.max(0, remaining - countB);

    chosen.push(...pickRandom(dishesD, countD));
    chosen.push(...pickRandom(dishesC, countC));
    chosen.push(...pickRandom(dishesB, countB));
    chosen.push(...pickRandom(dishesA, countA));
  }

  state.selectedDishIds = new Set(chosen.map((d) => d.id));
  state.checkedIngredients.clear();
  renderAll();
  openShoppingListPopup(dom);
}

async function loadRecipesDatabase() {
  try {
    const response = await fetch("./data/recipes.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const list = Array.isArray(data) ? data : Array.isArray(data.recipes) ? data.recipes : [];
    state.dishes = list.map(normalizeRecipe).sort((a, b) => b.score - a.score);
  } catch (err) {
    console.error("Erreur lors du chargement de data/recipes.json :", err);
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}

async function bootstrap() {
  loadPersistedState();

  initPlannerBarEvents(dom, state, {
    onStateChange: renderAll,
    onAutoSuggest: autoSuggestBalancedMenu
  });

  initCatalogEvents(dom, state, {
    getSelectedCountsByCategory,
    onDishToggled: (reachedTarget) => {
      renderAll();
      if (reachedTarget) openShoppingListPopup(dom);
    },
    onFilterChange: (isQuotaAlert = false) => {
      if (isQuotaAlert) {
        renderPlannerBar(dom, state);
      } else {
        renderCatalog(dom, state, getSelectedCountsByCategory);
      }
    }
  });

  initBottomBarEvents(dom, state, { onClear: renderAll });

  initShoppingDialogEvents(dom, state, {
    onStateChange: renderAll,
    onPopupContentChange: () => renderShoppingPopupContent(dom, state, savePersistedState)
  });

  initPwaInstall(dom);
  registerServiceWorker();

  const toolbar = document.querySelector(".catalog-toolbar");
  if (toolbar) {
    const syncToolbarHeight = () => {
      document.documentElement.style.setProperty(
        "--catalog-toolbar-height",
        `${toolbar.offsetHeight}px`
      );
    };
    syncToolbarHeight();
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(syncToolbarHeight).observe(toolbar);
    }
  }
  await loadRecipesDatabase();
  renderAll();
}

bootstrap();
