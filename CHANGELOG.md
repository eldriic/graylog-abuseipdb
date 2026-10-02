# Changelog

Toutes les évolutions notables de ce projet sont documentées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le
projet respecte le [versionnage sémantique](https://semver.org/lang/fr/).

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

[1.4.1]: https://github.com/eldriic/graylog-abuseipdb/releases/tag/v1.4.1
[1.4.0]: https://github.com/eldriic/graylog-abuseipdb/releases/tag/v1.4.0
[1.3.0]: https://github.com/eldriic/graylog-abuseipdb/releases/tag/v1.3.0
[1.2.0]: https://github.com/eldriic/graylog-abuseipdb/releases/tag/v1.2.0
[1.1.0]: https://github.com/eldriic/graylog-abuseipdb/releases/tag/v1.1.0
[1.0.0]: https://github.com/eldriic/graylog-abuseipdb/releases/tag/v1.0.0
