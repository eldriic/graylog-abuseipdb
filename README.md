<div align="center">

<img src="src/icons/icon-128.png" alt="" width="96" height="96">

# Graylog AbuseIPDB Lookup

**Réputation AbuseIPDB et géolocalisation des adresses IP, directement dans Graylog.**

[![CI](https://github.com/eldriic/graylog-abuseipdb/actions/workflows/ci.yml/badge.svg)](https://github.com/eldriic/graylog-abuseipdb/actions/workflows/ci.yml)
![Firefox](https://img.shields.io/badge/Firefox-142%2B-FF7139?logo=firefoxbrowser&logoColor=white)
![Chrome](https://img.shields.io/badge/Chrome%20%2F%20Edge%20%2F%20Brave-116%2B-4285F4?logo=googlechrome&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

Extension de navigateur pour analystes SOC : elle repère les colonnes d'IP de
Graylog (par défaut toutes les colonnes ne contenant que des IP, ou seulement
celles que vous choisissez) et affiche à côté de chaque IP son score d'abus, sa ville et son pays —
**sans toucher aux IP noyées dans du texte**, et uniquement sur les sites
Graylog que vous avez autorisés.

<p align="center">
  <img src="docs/images/badges-tooltip.png" alt="Badges AbuseIPDB dans un tableau Graylog" width="720">
</p>

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Navigateurs supportés](#navigateurs-supportés)
- [Installation](#installation)
- [Configuration](#configuration)
- [Utilisation](#utilisation)
- [Développement](#développement)
- [Confidentialité](#confidentialité)
- [Licence](#licence)

## Fonctionnalités

- **Badge par IP** dans les widgets d'agrégation, les tableaux de messages et
  la vue détaillée d'un message : score, ville, pays, mention `TOR`.
- **Info-bulle détaillée** au survol : signalements, ISP, ASN, domaine, type
  d'usage, whitelist, date du dernier signalement, lien vers AbuseIPDB.
- **Alertes** : les lignes dont le score atteint le seuil d'alerte (75 % par
  défaut) sont surlignées, et leur nombre s'affiche sur l'icône de
  l'extension.
- **Popup** dans la barre d'outils, en deux onglets :
  - **Analyse** : IP de la page triées par risque avec détails dépliables,
    recherche manuelle d'une IP, copie des IP et export CSV ;
  - **Paramètres** : sites Graylog autorisés, clé API (avec test de validité),
    champs Graylog, seuil d'alerte, cache, réserve de quota, et suivi de
    l'utilisation AbuseIPDB — requêtes du jour, quota restant du compte,
    historique sur 7 jours.
- **Menu contextuel** : sélectionnez une IP sur n'importe quelle page, clic
  droit → **Vérifier sur AbuseIPDB**.
- **Détection automatique** (par défaut) : toute colonne ne contenant que des
  IP (`o365_audit_ClientIP`, `remip`, `src_ip`…) reçoit des badges, sans
  configuration ; des champs peuvent en être exclus.
- **Champs au choix** : détection désactivée, seuls les champs listés sont
  analysés.
- **Toutes les IP** (désactivé par défaut) : chaque IP des résultats reçoit un
  badge, y compris au milieu d'un texte (`message`, `logdesc`…), un badge par
  adresse.
- **Économe en quota** : cache local (24 h par défaut, entrées expirées purgées
  automatiquement), déduplication et limitation des requêtes simultanées,
  réserve de quota pour les recherches manuelles ; les IP privées ou
  réservées ne sont jamais envoyées.
- **Accès minimal** : l'extension ne lit aucune page tant que vous n'avez pas
  autorisé votre instance Graylog.

<p align="center">
  <img src="docs/images/popup.png" alt="Popup : IP de la page" width="270">
  &nbsp;
  <img src="docs/images/popup-details.png" alt="Popup : détails d'une IP" width="270">
  &nbsp;
  <img src="docs/images/settings.png" alt="Popup : paramètres et utilisation de l'API" width="270">
</p>

| Couleur   | Score     | Signification                    |
| --------- | --------- | -------------------------------- |
| 🟢 Vert   | 0 %       | Aucun signalement                |
| 🟡 Jaune  | 1 – 24 %  | Signalements isolés              |
| 🟠 Orange | 25 – 74 % | Suspect                          |
| 🔴 Rouge  | 75 %+     | Malveillant avec forte confiance |
| ⚪ Gris   | —         | IP privée ou réservée, non interrogée ; ou réserve de quota atteinte (`quota`) |

## Navigateurs supportés

| Navigateur                          | Build          | Manifest |
| ----------------------------------- | -------------- | -------- |
| Firefox 142+                        | `dist/firefox` | V2       |
| Chrome, Edge, Brave, Opera, Vivaldi | `dist/chrome`  | V3       |

> Safari n'est pas supporté : la conversion exige macOS et Xcode
> (`xcrun safari-web-extension-converter`).

## Installation

Récupérez l'archive du navigateur voulu dans les
[Releases](https://github.com/eldriic/graylog-abuseipdb/releases), ou
construisez-la vous-même (voir [Développement](#développement)).

> 📘 **Guide pas à pas** (Chrome, Firefox, configuration, mise à jour,
> dépannage) : [docs/INSTALL.md](docs/INSTALL.md).

### Chrome, Edge, Brave, Opera, Vivaldi

1. Décompressez `graylog-abuseipdb-chrome-<version>.zip` (ou utilisez `dist/chrome`).
2. Ouvrez `chrome://extensions` (`edge://extensions` sur Edge, `brave://extensions` sur Brave).
3. Activez le **Mode développeur**.
4. Cliquez sur **Charger l'extension non empaquetée** et sélectionnez le dossier.

### Firefox

Firefox n'installe de façon permanente que des extensions signées par Mozilla
(signature gratuite, sans publication sur le store) :

```bash
export WEB_EXT_API_KEY='user:xxxxxxxx:xxx'   # https://addons.mozilla.org/developers/addon/api/key/
export WEB_EXT_API_SECRET='…'
npm run sign:firefox
```

Le fichier `.xpi` signé est déposé dans `artifacts/` : glissez-le dans une
fenêtre Firefox.

Pour un test rapide sans signature : `about:debugging#/runtime/this-firefox` →
**Charger un module complémentaire temporaire** → `dist/firefox/manifest.json`
(retiré au redémarrage de Firefox).

## Configuration

### Autoriser votre Graylog

Par défaut, l'extension n'a accès à **aucune page**. Pour l'activer sur votre
instance Graylog, au choix :

- ouvrez Graylog, cliquez sur l'icône de l'extension → **Activer sur ce site** ;
- ou onglet **Paramètres** → **Sites Graylog** → saisissez l'adresse
  (ex. `https://graylog.exemple.fr`) → **Ajouter**.

Le navigateur demande alors la permission d'accéder à ce site. L'autorisation
couvre tous les ports de l'hôte (`:9000` compris) ; elle se retire depuis la
même liste ou depuis les réglages d'extensions du navigateur.

### Paramètres

Cliquez sur l'icône de l'extension → onglet **Paramètres** (le même panneau est
disponible dans les options du navigateur). Chaque réglage est enregistré dès
qu'il est modifié :

| Paramètre            | Défaut                | Description                                                            |
| -------------------- | --------------------- | ---------------------------------------------------------------------- |
| Clé API AbuseIPDB    | —                     | [abuseipdb.com/account/api](https://www.abuseipdb.com/account/api)     |
| Détection automatique | activée              | Enrichit toutes les colonnes dont les valeurs sont des IP              |
| Toutes les IP        | désactivé             | Enrichit aussi les IP au milieu d'un texte, dans toutes les colonnes   |
| Champs exclus        | —                     | Avec la détection ou toutes les IP : colonnes jamais enrichies         |
| Champs à analyser    | `o365_audit_ClientIP` | Sans la détection : seules colonnes enrichies                          |
| `maxAgeInDays`       | `90`                  | Fenêtre d'historique des signalements AbuseIPDB                        |
| Durée du cache       | `24` h                | `0` pour désactiver                                                    |
| Seuil d'alerte       | `75` %                | Surlignage des lignes et compteur sur l'icône ; `0` pour désactiver    |
| Réserve de quota     | `50`                  | Requêtes gardées pour la recherche manuelle (voir ci-dessous)          |

Les listes de champs se séparent par des virgules ; la casse est ignorée.

**Détection automatique** : une colonne (ou un champ de la vue détaillée) est
retenue quand toutes ses valeurs non vides sont exactement une adresse IP ; les
cellules vides des agrégations sont ignorées. Une IP au milieu d'un texte
(colonne `message`, `logdesc`…) ne compte pas, et les métadonnées internes de
Graylog (`gl2_*`, comme `gl2_remote_ip`) sont toujours exclues. Chaque IP
publique détectée consomme une requête : la réserve de quota s'applique.

**Toutes les IP** : chaque colonne et chaque champ (sauf exclus et `gl2_*`) est
analysé, et chaque IP trouvée reçoit son propre badge, préfixé de l'adresse
quand une cellule en contient plusieurs. La détection automatique est alors
englobée. À réserver aux recherches ciblées : une page de messages peut
contenir beaucoup d'IP, et chacune consomme une requête.

**Champs à analyser** : quand la détection et « Toutes les IP » sont
désactivées, seules ces colonnes sont enrichies (première IP de la cellule, y
compris entourée d'autre texte).

**Tester la clé** effectue une vraie requête (elle compte dans le quota) et
affiche le quota restant.

Le plan gratuit AbuseIPDB autorise **1 000 requêtes par jour**, réinitialisées
à 00:00 UTC. L'onglet Paramètres distingue :

- **les requêtes faites par l'extension** dans ce navigateur, comptées jour par
  jour (seules les requêtes acceptées par AbuseIPDB sont comptées ; les
  résultats servis depuis le cache ne consomment rien) ;
- **le quota restant du compte**, lu dans les en-têtes de réponse d'AbuseIPDB —
  il inclut donc l'usage de la même clé par d'autres outils.

Quand le quota restant descend à la **réserve**, les recherches automatiques
(badges, liste de la popup) s'arrêtent et affichent un badge gris `quota` ; la
recherche manuelle et le menu contextuel restent disponibles jusqu'à
l'épuisement du quota. Le bouton ↻ relance les recherches en échec.

## Utilisation

1. Ouvrez une recherche Graylog (site autorisé) dont le résultat contient une
   colonne d'IP.
2. Les badges apparaissent automatiquement, y compris après un rafraîchissement
   ou un changement de requête ; les lignes au-dessus du seuil d'alerte sont
   surlignées en rouge.
3. Survolez un badge pour le détail, ou cliquez sur l'icône de l'extension pour
   la vue d'ensemble ; le bouton ↻ actualise la liste après un changement de
   recherche. **Copier** place les IP publiques dans le presse-papiers (une
   par ligne), **CSV** télécharge tous les résultats (séparateur `;`).
4. Ailleurs (ticket, e-mail, autre outil) : sélectionnez une IP, clic droit →
   **Vérifier « … » sur AbuseIPDB**. Sur les navigateurs qui ne permettent pas
   d'ouvrir la popup par programme, la page AbuseIPDB de l'IP s'ouvre dans un
   nouvel onglet.

## Développement

Prérequis : Node.js 20+.

```bash
npm install
npm run build            # dist/firefox et dist/chrome
npm test                 # tests unitaires (node:test)
npm run lint             # vérification syntaxe + web-ext lint (Firefox)
npm run package          # archives .zip dans artifacts/
npm run start:firefox    # lance Firefox avec l'extension chargée
npm run start:chrome     # lance Chromium avec l'extension chargée
```

### Structure

```
├── manifests/
│   ├── base.json          # champs communs
│   ├── firefox.json       # Manifest V2 (background scripts, gecko id)
│   └── chrome.json        # Manifest V3 (service worker, host_permissions)
├── scripts/
│   ├── build.mjs          # src/ + manifest fusionné → dist/<navigateur>/
│   └── check.mjs          # vérification de syntaxe JavaScript
├── test/                  # tests unitaires des modules partagés
└── src/
    ├── background/        # requêtes AbuseIPDB / ipwho.is, cache, quota, sites, menu contextuel
    ├── content/           # détection des champs Graylog, badges et alertes
    ├── popup/             # interface de la barre d'outils, export
    ├── options/           # page de paramètres
    ├── shared/            # compatibilité browser/chrome, IP, paramètres, sites, panneau partagé
    └── icons/
```

Le content script n'est pas déclaré dans le manifest : le background
l'enregistre (`scripting.registerContentScripts`) sur les seuls sites
autorisés, à partir des permissions d'hôte optionnelles accordées.

Le code source est unique : `src/shared/api.js` expose `ext`, qui pointe vers
`browser` (Firefox) ou `chrome` (Chromium). La version est définie une seule
fois, dans `package.json`, et injectée dans chaque manifest au build.

### Publier une version

1. Mettez à jour `version` dans `package.json` et le [CHANGELOG](CHANGELOG.md).
2. Committez, puis créez et poussez un tag :
   ```bash
   git tag v1.2.0 && git push origin v1.2.0
   ```
3. La CI publie une Release GitHub avec les archives Firefox et Chrome.

## Confidentialité

- L'extension ne lit que les pages des sites Graylog que vous avez autorisés.
- Seules les IP **publiques** des champs analysés sont envoyées, et uniquement à
  [AbuseIPDB](https://www.abuseipdb.com) (réputation) et
  [ipwho.is](https://ipwho.is) (ville / région).
- La clé API et le cache restent dans le stockage local du navigateur ; aucune
  autre donnée de la page ne quitte la machine.
- Détails : [politique de confidentialité](PRIVACY.md).
- Les captures d'écran de ce dépôt utilisent des adresses de documentation
  (RFC 5737 / RFC 3849) et des données fictives.

## Licence

[MIT](LICENSE)
