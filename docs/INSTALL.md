# Guide d'installation

Ce guide détaille l'installation de **Graylog AbuseIPDB Lookup** sur Chrome
(et navigateurs Chromium) et sur Firefox, sa première configuration, sa mise à
jour et la résolution des problèmes courants.

L'extension n'est publiée ni sur le Chrome Web Store ni sur addons.mozilla.org :
elle s'installe à partir des archives des
[Releases GitHub](https://github.com/eldriic/graylog-abuseipdb/releases) ou
d'un build local.

## Sommaire

- [Prérequis](#prérequis)
- [Chrome, Edge, Brave, Opera, Vivaldi](#chrome-edge-brave-opera-vivaldi)
- [Firefox](#firefox)
  - [Option A — Version signée (recommandée)](#option-a--version-signée-recommandée)
  - [Option B — Chargement temporaire (test)](#option-b--chargement-temporaire-test)
  - [Option C — Firefox Developer Edition, Nightly ou ESR](#option-c--firefox-developer-edition-nightly-ou-esr)
- [Première configuration](#première-configuration)
- [Vérifier que tout fonctionne](#vérifier-que-tout-fonctionne)
- [Mettre à jour](#mettre-à-jour)
- [Désinstaller](#désinstaller)
- [Dépannage](#dépannage)

## Prérequis

| Élément              | Détail                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------- |
| Navigateur           | Chrome / Edge / Brave / Opera / Vivaldi **116+**, ou Firefox **142+**                       |
| Clé API AbuseIPDB    | Compte gratuit sur [abuseipdb.com](https://www.abuseipdb.com/register), puis [clé API](https://www.abuseipdb.com/account/api) |
| Accès Graylog        | Une recherche dont les résultats contiennent une colonne d'IP (ex. `o365_audit_ClientIP`, `remip`) |
| Node.js 20+          | Uniquement pour construire l'extension soi-même ou la signer pour Firefox                    |

Pour connaître votre version : `chrome://version` (Chromium) ou menu
**☰ → Aide → À propos de Firefox**.

## Chrome, Edge, Brave, Opera, Vivaldi

Les navigateurs Chromium acceptent une extension « non empaquetée » (un
dossier) dès que le mode développeur est activé.

### 1. Récupérer l'extension

**Depuis les Releases (le plus simple)**

1. Ouvrez la [dernière Release](https://github.com/eldriic/graylog-abuseipdb/releases/latest).
2. Dans **Assets**, téléchargez `graylog-abuseipdb-chrome-<version>.zip`.
3. Décompressez l'archive dans un dossier **permanent**, par exemple :
   - Windows : `C:\Users\<vous>\Extensions\graylog-abuseipdb`
   - Linux / macOS : `~/Extensions/graylog-abuseipdb`

   Le dossier doit contenir directement `manifest.json` (et non un
   sous-dossier qui le contient).

> [!IMPORTANT]
> Ne supprimez pas et ne déplacez pas ce dossier après l'installation : le
> navigateur le lit à chaque démarrage. Évitez le dossier *Téléchargements*,
> souvent nettoyé.

**Ou depuis les sources**

```bash
git clone https://github.com/eldriic/graylog-abuseipdb.git
cd graylog-abuseipdb
npm install
npm run build:chrome      # produit dist/chrome/
```

Le dossier à charger est alors `dist/chrome`.

### 2. Charger l'extension

1. Ouvrez la page des extensions :

   | Navigateur | Adresse                |
   | ---------- | ---------------------- |
   | Chrome     | `chrome://extensions`  |
   | Edge       | `edge://extensions`    |
   | Brave      | `brave://extensions`   |
   | Opera      | `opera://extensions`   |
   | Vivaldi    | `vivaldi://extensions` |

2. Activez le **Mode développeur** (interrupteur en haut à droite ; sur Edge,
   dans le panneau de gauche).
3. Cliquez sur **Charger l'extension non empaquetée**
   (*Load unpacked*).
4. Sélectionnez le dossier qui contient `manifest.json`.

La carte **Graylog AbuseIPDB Lookup** apparaît dans la liste.

### 3. Épingler l'icône

Cliquez sur l'icône 🧩 (Extensions) de la barre d'outils, puis sur la punaise
📌 à côté de **Graylog AbuseIPDB Lookup** pour garder l'icône visible.

L'extension n'a accès à aucune page tant que vous n'avez pas autorisé votre
instance Graylog : voir [Première configuration](#première-configuration).

## Firefox

Firefox **Release** n'installe de façon permanente que des extensions signées
par Mozilla. Trois possibilités :

| Option | Pour qui                                   | Permanente | Effort                         |
| ------ | ------------------------------------------ | ---------- | ------------------------------ |
| A      | Usage quotidien                            | ✅         | Compte Mozilla + une commande  |
| B      | Essai rapide                               | ❌         | Aucun                          |
| C      | Utilisateurs de Developer Edition / Nightly / ESR | ✅  | Un réglage `about:config`      |

### Option A — Version signée (recommandée)

La signature est gratuite et se fait en mode *unlisted* : l'extension n'est
**pas** publiée sur le store, Mozilla se contente de la signer.

1. **Créer un compte** sur [addons.mozilla.org](https://addons.mozilla.org)
   (connexion avec un compte Mozilla).
2. **Générer des identifiants API** sur
   [addons.mozilla.org/developers/addon/api/key](https://addons.mozilla.org/developers/addon/api/key/)
   → **Générer de nouveaux identifiants**. Vous obtenez :
   - un **émetteur JWT** (`user:12345678:123`) ;
   - un **secret JWT** (longue chaîne hexadécimale) — à garder secret.
3. **Cloner et préparer le projet** (Node.js 20+) :

   ```bash
   git clone https://github.com/eldriic/graylog-abuseipdb.git
   cd graylog-abuseipdb
   npm install
   ```

4. **Signer** :

   ```bash
   export WEB_EXT_API_KEY='user:12345678:123'
   export WEB_EXT_API_SECRET='votre-secret-jwt'
   npm run sign:firefox
   ```

   Sous Windows (PowerShell) :

   ```powershell
   $env:WEB_EXT_API_KEY = 'user:12345678:123'
   $env:WEB_EXT_API_SECRET = 'votre-secret-jwt'
   npm run sign:firefox
   ```

   La validation par Mozilla prend en général de quelques secondes à quelques
   minutes. Le fichier signé est déposé dans `artifacts/`
   (`graylog_abuseipdb_lookup-<version>.xpi` ou similaire).

5. **Installer** le `.xpi` :
   - glissez-déposez le fichier dans une fenêtre Firefox ;
   - ou `about:addons` → ⚙️ → **Installer un module depuis un fichier…**.

6. Firefox affiche les permissions demandées et la **collecte de données**
   (contenu des sites web : les IP des champs analysés) → **Ajouter**.
   L'accès à votre Graylog est demandé plus tard, lors de la
   [première configuration](#première-configuration).

7. Épinglez l'icône : bouton 🧩 de la barre d'outils → ⚙️ à côté de
   l'extension → **Épingler à la barre d'outils**.

> [!TIP]
> Le `.xpi` signé peut être partagé avec vos collègues : ils n'ont qu'à
> l'installer (étape 5), sans compte Mozilla ni Node.js.

### Option B — Chargement temporaire (test)

Aucune signature requise, mais l'extension est **retirée à la fermeture de
Firefox**.

1. Téléchargez `graylog-abuseipdb-firefox-<version>.zip` depuis la
   [dernière Release](https://github.com/eldriic/graylog-abuseipdb/releases/latest)
   (inutile de le décompresser), ou construisez `dist/firefox` avec
   `npm run build:firefox`.
2. Ouvrez `about:debugging#/runtime/this-firefox`.
3. Cliquez sur **Charger un module complémentaire temporaire…**.
4. Sélectionnez le fichier `.zip`, ou `manifest.json` dans `dist/firefox`.

### Option C — Firefox Developer Edition, Nightly ou ESR

Ces éditions (contrairement à Firefox Release) permettent de désactiver la
vérification de signature :

1. Ouvrez `about:config` et acceptez l'avertissement.
2. Recherchez `xpinstall.signatures.required` et passez-le à `false`.
3. Installez le `.zip` de la Release via `about:addons` → ⚙️ →
   **Installer un module depuis un fichier…** (renommez-le en `.xpi` si le
   sélecteur ne l'affiche pas).

## Première configuration

1. **Autorisez votre Graylog** : ouvrez-le dans un onglet, cliquez sur l'icône
   de l'extension → **Activer sur ce site**, puis acceptez la demande du
   navigateur. Autre possibilité : onglet **Paramètres** → **Sites Graylog** →
   saisissez l'adresse (ex. `https://graylog.exemple.fr`) → **Ajouter**.
2. Onglet **Paramètres** (également accessible depuis les options de
   l'extension) : collez votre **clé API AbuseIPDB**. Les réglages sont
   enregistrés automatiquement, sans bouton à cliquer.
3. Cliquez sur **Tester la clé** : le quota restant s'affiche si la clé est
   valide (ce test consomme une requête).
4. Choisissez les colonnes analysées (carte **Détection**) :
   - par défaut, la **détection automatique** enrichit toutes les colonnes ne
     contenant que des IP (`o365_audit_ClientIP`, `remip`, `src_ip`…) ;
     listez dans **Champs exclus** celles à ignorer (ex. `source`) ;
   - pour n'analyser que certains champs, désactivez la détection et listez-les
     dans **Champs à analyser** (ex. `o365_audit_ClientIP, remip`) ;
   - pour enrichir aussi les IP au milieu d'un texte (`message`, `logdesc`…),
     activez **Toutes les IP** (désactivé par défaut, consomme beaucoup de
     quota).

   Les noms doivent correspondre aux colonnes affichées dans Graylog (casse
   ignorée), séparés par des virgules.

Les autres réglages (`maxAgeInDays`, cache, seuil d'alerte, réserve de quota)
sont décrits dans le [README](../README.md#paramètres).

## Vérifier que tout fonctionne

1. Ouvrez Graylog et lancez une recherche dont les résultats affichent le
   colonne d'IP (tableau de messages, widget d'agrégation ou détail d'un
   message).
2. Un badge coloré (score, ville, pays) doit apparaître à côté de chaque IP
   publique de ce champ ; les IP privées s'affichent en gris.
3. Survolez un badge pour afficher le détail.
4. Cliquez sur l'icône de l'extension : l'onglet **Analyse** liste les IP de
   la page, triées par risque.

## Mettre à jour

Les réglages (clé API, champs, cache) sont conservés lors d'une mise à jour.

> [!NOTE]
> Depuis la version 1.5.0, l'extension ne lit plus toutes les pages : après
> une mise à jour depuis une version 1.4.x, autorisez votre Graylog une fois
> (icône de l'extension → **Activer sur ce site**).

**Chrome et dérivés**

1. Téléchargez la nouvelle archive Chrome.
2. Remplacez le **contenu** du dossier existant par celui de la nouvelle
   archive — gardez le **même chemin** de dossier : pour une extension non
   empaquetée, l'identifiant (et donc les réglages enregistrés) dépend de ce
   chemin.
3. `chrome://extensions` → bouton ↻ (**Actualiser**) sur la carte de
   l'extension.
4. Rechargez les onglets Graylog ouverts.

Depuis les sources : `git pull && npm run build:chrome`, puis étapes 3 et 4.

**Firefox (version signée)**

1. `git pull`, puis augmentez `version` dans `package.json` si elle n'a pas
   changé (Mozilla refuse de signer deux fois la même version).
2. `npm run sign:firefox`.
3. Installez le nouveau `.xpi` par-dessus l'ancien (mêmes étapes que
   l'installation).

## Désinstaller

- **Chrome et dérivés** : `chrome://extensions` → **Supprimer** sur la carte,
  puis supprimez le dossier de l'extension.
- **Firefox** : `about:addons` → **…** à côté de l'extension → **Supprimer**.

La clé API et le cache sont effacés avec l'extension.

## Dépannage

| Symptôme | Cause probable | Solution |
| -------- | -------------- | -------- |
| *Le fichier manifeste est introuvable ou illisible* (Chrome) | Mauvais dossier sélectionné | Sélectionnez le dossier qui contient directement `manifest.json` |
| L'extension disparaît après redémarrage de Chrome | Dossier supprimé ou déplacé | Décompressez dans un dossier permanent et rechargez-la |
| Edge / Chrome affiche *Désactiver les extensions en mode développeur* | Avertissement normal pour les extensions non empaquetées | Cliquez sur la croix ou **Conserver** ; l'extension reste active |
| *Ce module complémentaire n'a pas pu être installé car il n'a pas été vérifié* (Firefox) | `.zip` non signé sur Firefox Release | Utilisez l'option [A](#option-a--version-signée-recommandée) ou [B](#option-b--chargement-temporaire-test) |
| *Ce module n'est pas compatible avec votre version de Firefox* | Firefox antérieur à 142 | Mettez Firefox à jour |
| `npm run sign:firefox` : *Duplicate add-on ID found* / *add-on ID already in use* | L'identifiant `graylog-abuseipdb@local` est déjà associé à un autre compte Mozilla | Remplacez `gecko.id` dans `manifests/firefox.json` par un identifiant unique (ex. `graylog-abuseipdb@votre-domaine`) puis relancez |
| `npm run sign:firefox` : *Version already exists* | Version déjà signée | Augmentez `version` dans `package.json` |
| `npm run sign:firefox` : *401 / Unauthorized* | Identifiants API incorrects ou variables non exportées | Vérifiez `WEB_EXT_API_KEY` / `WEB_EXT_API_SECRET` dans le terminal courant |
| Aucun badge dans Graylog, la popup propose **Activer sur ce site** | Site Graylog non autorisé | Cliquez sur **Activer sur ce site** et acceptez la demande du navigateur |
| Aucun badge dans Graylog, site autorisé | Détection désactivée et nom de champ différent, ou colonne exclue | Vérifiez la carte **Détection** des **Paramètres** ; la popup indique le mode et les champs |
| Popup : *Rechargez la page pour lancer l'analyse* | Onglet ouvert pendant une mise à jour de l'extension | Rechargez l'onglet Graylog |
| Badges gris `privée` | IP privées ou réservées (RFC 1918, CGNAT, loopback…) | Comportement normal : elles ne sont jamais envoyées à AbuseIPDB |
| Badges gris `quota` | Réserve de quota atteinte | Attendez la réinitialisation (00:00 UTC), baissez la **réserve de quota** puis cliquez sur le bouton vert d'actualisation de la popup, ou utilisez la recherche manuelle |
| Badges « erreur » | Requête refusée — survolez le badge pour lire le message exact | Voir les lignes suivantes |
| Survol : *Clé API AbuseIPDB manquante* | Aucune clé enregistrée | Saisissez la clé dans **Paramètres** |
| Survol : *AbuseIPDB: … authentication …* ou *HTTP 401* | Clé API invalide | Ressaisissez la clé et cliquez sur **Tester la clé** |
| Survol : *AbuseIPDB: Daily rate limit … exceeded* ou *HTTP 429* | Quota AbuseIPDB du jour épuisé | Attendez la réinitialisation (00:00 UTC) ou augmentez la durée du cache |
