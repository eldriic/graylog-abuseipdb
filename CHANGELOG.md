# Changelog

Toutes les évolutions notables de ce projet sont documentées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le
projet respecte le [versionnage sémantique](https://semver.org/lang/fr/).

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

[1.2.0]: https://github.com/eldriic/graylog-abuseipdb/releases/tag/v1.2.0
[1.1.0]: https://github.com/eldriic/graylog-abuseipdb/releases/tag/v1.1.0
[1.0.0]: https://github.com/eldriic/graylog-abuseipdb/releases/tag/v1.0.0
