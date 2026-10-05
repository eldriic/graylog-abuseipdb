# Changelog

Toutes les évolutions notables de ce projet sont documentées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le
projet respecte le [versionnage sémantique](https://semver.org/lang/fr/).

## [1.5.1] - 2026-10-05

### Modifié

- Description de la fiche addons.mozilla.org en Markdown (AMO n'interprète
  plus le HTML).
- Première publication sur addons.mozilla.org des nouveautés de la 1.5.0
  (numéro 1.5.0 déjà utilisé par une signature non listée).

## [1.5.0] - 2026-10-02

### Ajouté

- Compteur sur l'icône de l'extension : nombre d'IP de l'onglet dont le score
  atteint le **seuil d'alerte** (75 % par défaut, réglable).
- Surlignage des lignes Graylog dont le score atteint le seuil d'alerte.
- Menu contextuel **Vérifier « … » sur AbuseIPDB** sur une sélection de texte.
- Copie des IP et export CSV depuis la popup.
- **Détection automatique** des colonnes d'IP, activée par défaut : toute
  colonne ou tout champ dont les valeurs sont uniquement des IP
  (`o365_audit_ClientIP`, `remip`, `src_ip`…) reçoit des badges ; **champs
  exclus** configurables, métadonnées `gl2_*` toujours exclues.
- Détection désactivée : un ou plusieurs **champs à analyser** au choix
  (séparés par des virgules).
- Option **Toutes les IP** (désactivée par défaut) : badge sur chaque IP des
  résultats, y compris au milieu d'un texte, un badge par adresse.
- **Réserve de quota** : les recherches automatiques s'arrêtent quand il reste
  ce nombre de requêtes (50 par défaut), la recherche manuelle reste possible.
- Tests unitaires (`npm test`), exécutés par la CI.

### Modifié

- Paramètres repensés : sections en cartes (clé API, sites, détection, quota et
  cache), interrupteurs, unités affichées, enregistrement automatique à
  chaque modification (le bouton **Enregistrer** disparaît).
- Bouton d'actualisation de la popup redessiné (icône verte).
- **L'extension ne lit plus toutes les pages** : chaque instance Graylog est
  autorisée explicitement (bouton **Activer sur ce site** de la popup ou
  liste **Sites Graylog** des paramètres). Après la mise à jour, autorisez
  votre Graylog une fois.
- Au plus 4 requêtes AbuseIPDB simultanées ; plus aucune requête quand le
  quota du jour est épuisé.
- Les entrées expirées du cache sont purgées automatiquement.
- L'info-bulle s'affiche au-dessus du badge près du bas de la fenêtre.
- La recherche manuelle accepte un texte contenant une IP et refuse les
  saisies invalides sans consommer de requête.

### Corrigé

- Plages d'adresses réservées envoyées à tort aux API : CGNAT
  (`100.64.0.0/10`), multicast, broadcast, plages de documentation et de
  test, IPv6 multicast et IPv4-mappées (`::ffff:10.0.0.1`).
- Les adresses aux octets invalides (`999.1.1.1`) ne sont plus détectées.
- Un résultat arrivé après le réaffichage d'une cellule par Graylog ne
  s'applique plus à la mauvaise IP.
- Une ligne de message dépliée (cellule couvrant toutes les colonnes) n'est
  plus prise pour une valeur de champ.

## [1.4.1] - 2026-10-02

### Ajouté

- Publication sur addons.mozilla.org : fiche du store
  (`store/firefox/amo-metadata.json`), captures d'écran, commande
  `npm run submit:firefox`.
- [Politique de confidentialité](PRIVACY.md).
- Page de démonstration reproduisant le balisage Graylog (`docs/demo/`).
- [Guide d'installation](docs/INSTALL.md) détaillé pour Chrome et Firefox.

### Modifié

- `web-ext` 10.

## [1.4.0] - 2026-10-01

### Ajouté

- Bouton **Actualiser** (↻) dans la popup : relit la page Graylog et recharge
  la liste des IP (les résultats en cache ne consomment pas de quota).

### Modifié

- Un changement du champ Graylog dans les paramètres s'applique sans recharger
  la page.

## [1.3.0] - 2026-10-01

### Ajouté

- Onglet **Paramètres** dans la popup : clé API (affichage masqué / visible),
  champ Graylog, historique, cache.
- Bouton **Tester la clé** avec affichage du quota restant.
- Suivi de l'utilisation AbuseIPDB : requêtes du jour faites par l'extension,
  quota restant du compte, historique des 7 derniers jours.
- Nombre d'IP en cache et vidage du cache depuis les paramètres.

### Modifié

- La page d'options du navigateur utilise le même panneau que la popup.
- La popup s'ouvre sur les paramètres tant qu'aucune clé API n'est configurée.

## [1.2.0] - 2026-10-01

### Ajouté

- Build Chromium (Manifest V3) : Chrome, Edge, Brave, Opera, Vivaldi.
- Pipeline de build unique (`npm run build`) générant un manifest par navigateur.
- Intégration continue GitHub Actions et publication automatique des Releases.
- Icônes PNG pour tous les navigateurs.

### Corrigé

- Le texte du badge pouvait être relu comme partie de l'IP lors d'un nouveau
  scan (`192.0.2.15` devenait `192.0.2.150`).
- Les heures (`14:06:29`) pouvaient être détectées comme des adresses IPv6.
- Le nom du champ s'affiche avec sa casse d'origine dans la popup.

## [1.1.0] - 2026-10-01

### Ajouté

- Popup dans la barre d'outils : IP de la page triées par risque, détails
  dépliables, recherche manuelle, quota AbuseIPDB, vidage du cache.

## [1.0.0] - 2026-10-01

### Ajouté

- Badges AbuseIPDB (score, ville, pays) sur le champ `o365_audit_ClientIP`.
- Info-bulle détaillée et lien vers AbuseIPDB.
- Page de paramètres : clé API, champ, historique, durée du cache.

[1.5.1]: https://github.com/eldriic/graylog-abuseipdb/releases/tag/v1.5.1
[1.5.0]: https://github.com/eldriic/graylog-abuseipdb/releases/tag/v1.5.0
[1.4.1]: https://github.com/eldriic/graylog-abuseipdb/releases/tag/v1.4.1
[1.4.0]: https://github.com/eldriic/graylog-abuseipdb/releases/tag/v1.4.0
[1.3.0]: https://github.com/eldriic/graylog-abuseipdb/releases/tag/v1.3.0
[1.2.0]: https://github.com/eldriic/graylog-abuseipdb/releases/tag/v1.2.0
[1.1.0]: https://github.com/eldriic/graylog-abuseipdb/releases/tag/v1.1.0
[1.0.0]: https://github.com/eldriic/graylog-abuseipdb/releases/tag/v1.0.0
