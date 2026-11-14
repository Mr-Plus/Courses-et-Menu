# Mes petites courses

Site familial pour composer ses menus équilibrés de la semaine et générer automatiquement sa liste de courses par rayon.

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
│   └── recipes.json                 # Base de données des recettes et ingrédients
├── js/
│   ├── components/
│   │   ├── bottom-bar.js            # Barre inférieure 100 % largeur (suivi & validation)
│   │   ├── catalog.js               # Recherche sticky, filtres A/B/C/D et cartes de plats
│   │   ├── planner-bar.js           # Sélecteur de repas, suggestion équilibrée & quotas
│   │   ├── pwa-install.js           # Gestion installation WebApp iOS/Android
│   │   └── shopping-dialog.js       # Popup liste de courses, menu PDF & export IA
│   ├── app.js                       # Point d'entrée et orchestration d'état
│   ├── constants.js                 # Métadonnées nutritionnelles et utilitaires
│   └── pdf-print.js                 # Générateur PDF A4 autonome pour iOS standalone
├── index.html                       # Point d'entrée HTML
├── sw.js                            # Service Worker hors-ligne
├── netlify.toml                     # Configuration Netlify (headers & redirections)
└── README.md                        # Documentation du projet
```
