# Courses & Menu

Application web (PWA) pour composer ses menus équilibrés de la semaine et générer automatiquement sa liste de courses par rayon.

## Fonctionnalités principales

- **Catalogue classé par score nutritionnel (A à D)** : 62 recettes avec note sur 100 colorée, niveau de protéines et tags (`Cookeo`, `Végétarien`, `One-pot`).
- **Recherche et filtre visuel** : barre de recherche sticky et sélecteur déroulant par catégorie (A, B, C, D) ou par tag.
- **Planification & quotas** : choix du nombre de plats et de personnes, suggestion équilibrée automatique et règles de quotas personnalisables.
- **Résumé, impression & PDF** : agrégation des ingrédients par rayon avec détail par recette, export PDF A4 (liste de courses et fiches menu 8 blocs par page avec tags et dates à compléter) et export structuré pour IA.
- **PWA hors-ligne** : installable sur iOS et Android grâce au manifeste et au Service Worker.

## Structure du projet

```text
├── assets/
│   ├── apple-touch-icon.png         # Icône iOS (écran d'accueil)
│   ├── favicon.svg                  # Icône vectorielle principale
│   ├── icon-192.png                 # Icône PWA 192x192
│   ├── icon-512.png                 # Icône PWA 512x512
│   ├── icon-maskable-512.png        # Icône PWA adaptative Android
│   └── manifest.webmanifest         # Manifeste d'installation WebApp (PWA)
├── css/
│   └── styles.css                   # Feuille de style principale & responsive mobile
├── data/
│   └── recipes.json                 # Base de données des recettes, tags et ingrédients
├── js/
│   ├── components/
│   │   ├── bottom-bar.js            # Barre inférieure 100 % largeur (suivi & validation)
│   │   ├── catalog.js               # Recherche sticky, sélecteur catégories/tags et cartes
│   │   ├── planner-bar.js           # Nombre de plats/personnes, suggestion & quotas
│   │   ├── pwa-install.js           # Gestion installation WebApp iOS/Android
│   │   └── shopping-dialog.js       # Modale plein écran liste de courses, PDF & export IA
│   ├── app.js                       # Point d'entrée et orchestration d'état
│   ├── constants.js                 # Métadonnées nutritionnelles et normalisation
│   └── pdf-print.js                 # Générateur PDF A4 autonome (8 fiches menu / page)
├── index.html                       # Point d'entrée HTML
├── sw.js                            # Service Worker hors-ligne
├── netlify.toml                     # Configuration Netlify (headers & redirections)
└── README.md                        # Documentation du projet
```
