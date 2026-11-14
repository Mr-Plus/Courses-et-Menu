/**
 * Constantes métier, métadonnées nutritionnelles et utilitaires purs.
 */

export const STORAGE_KEY = "mes-petites-courses-state-v1";
export const MIN_PRINT_MEAL_SLOTS = 8;

export const CATEGORIES_META = {
  A: {
    code: "A",
    title: "Équilibre & Vitalité",
    shortLabel: "Cat. A (Illimité)",
    subtitle: "Excellente densité nutritionnelle : fort apport en protéines et légumes/fibres, faible en graisses saturées.",
    badgeClass: "grade-a",
    quotaTagClass: "quota-cat-a",
    defaultScore: 85,
    defaultProtein: "Élevé • Riche en fibres",
    defaultFatSugar: "Gras faible • Sans sucres ajoutés"
  },
  B: {
    code: "B",
    title: "Bon Compromis",
    shortLabel: "Cat. B (Illimité)",
    subtitle: "Plats complets et rassasiants, riches en protéines avec féculents ou légumes et un apport lipidique maîtrisé.",
    badgeClass: "grade-b",
    quotaTagClass: "quota-cat-b",
    defaultScore: 72,
    defaultProtein: "Bon (28g/pers.)",
    defaultFatSugar: "Glucides complets • Gras maîtrisé"
  },
  C: {
    code: "C",
    title: "Plaisir Modéré",
    shortLabel: "Cat. C (Modéré)",
    subtitle: "Bon apport protéique mais plus riche en graisses saturées (fromages, charcuterie, pâte feuilletée ou béchamel).",
    badgeClass: "grade-c",
    quotaTagClass: "quota-cat-c",
    defaultScore: 56,
    defaultProtein: "Modéré à élevé",
    defaultFatSugar: "Plus riche en lipides (fromage/sauce)"
  },
  D: {
    code: "D",
    title: "Plaisir Gourmand",
    shortLabel: "Cat. D (Gourmand)",
    subtitle: "Plats réconfortants riches en glucides raffinés ou crème/fromage. Conseillé à 1 seul plat maximum.",
    badgeClass: "grade-d",
    quotaTagClass: "quota-cat-d",
    defaultScore: 38,
    defaultProtein: "Variable",
    defaultFatSugar: "Riche en lipides saturés / glucides"
  }
};

/**
 * Normalise une chaîne pour générer un identifiant d'ingrédient ou de plat sans accents
 */
export function slugify(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Normalise une recette issue de `data/recipes.json`
 */
export function normalizeRecipe(raw) {
  const category = ["A", "B", "C", "D"].includes(String(raw.category).toUpperCase())
    ? String(raw.category).toUpperCase()
    : "B";
  const meta = CATEGORIES_META[category];
  const name = String(raw.name || "Plat sans nom").trim();
  const id = raw.id || slugify(name);
  const score = Number.isFinite(Number(raw.score)) ? Number(raw.score) : meta.defaultScore;

  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients.map((ing) => {
        const ingName = String(ing.name || "Ingrédient").trim();
        const qty = Number.isFinite(Number(ing.qty)) ? Number(ing.qty) : 1;
        const unit = String(ing.unit || "pièce").trim();
        return {
          key: ing.key || slugify(ingName),
          name: ingName,
          qty,
          unit,
          aisle: ing.aisle || "Épicerie Salée",
          detail: ing.detail || `${qty} ${unit} — ${ingName}`
        };
      })
    : [];

  const rawDescription =
    raw.rawDescription ||
    ingredients.map((i) => `${i.qty} ${i.unit} de ${i.name.toLowerCase()}`).join(" + ");

  return {
    id,
    name,
    category,
    score,
    proteinLevel: raw.proteinLevel || meta.defaultProtein,
    fatSugarNote: raw.fatSugarNote || meta.defaultFatSugar,
    nutritionHighlight: raw.nutritionHighlight || name,
    rawDescription,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    ingredients
  };
}

/**
 * Calculateur de recommandations selon le nombre de plats souhaités.
 * Catégorie A : illimitée ; B : max 3 (1 si 1 seul repas) ; C et D : max 1 (0 si 1 seul repas).
 */
export function computeCategoryQuotas(targetMeals) {
  const n = Math.max(1, targetMeals);
  const maxB = n <= 1 ? 1 : 3;
  const maxC = n <= 1 ? 0 : 1;
  const maxD = n <= 1 ? 0 : 1;

  return {
    A: { max: Infinity },
    B: { max: maxB },
    C: { max: maxC },
    D: { max: maxD }
  };
}

/**
 * Retourne les quotas effectifs : recommandations de base si `strictQuotas` est actif,
 * ou quotas personnalisés par lettre sinon (`null` = illimité).
 */
export function getEffectiveQuotas(state) {
  if (state.strictQuotas) {
    return computeCategoryQuotas(state.targetMeals);
  }
  const custom = state.customQuotas || {};
  const toMax = (val, fallback) => {
    if (val === null || val === Infinity) return Infinity;
    return Number.isFinite(Number(val)) ? Math.max(0, Number(val)) : fallback;
  };
  return {
    A: { max: toMax(custom.A, Infinity) },
    B: { max: toMax(custom.B, 3) },
    C: { max: toMax(custom.C, 1) },
    D: { max: toMax(custom.D, 1) }
  };
}

export function formatQuantity(qty, unit) {
  if (unit === "g" && qty >= 1000) {
    const kg = qty / 1000;
    return `${Number.isInteger(kg) ? kg : kg.toFixed(2).replace(/\.?0+$/, "")} kg (${qty} g)`;
  }
  return `${qty} ${unit}`;
}
