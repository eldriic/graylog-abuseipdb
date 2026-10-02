# Politique de confidentialité

*Dernière mise à jour : 2 octobre 2026*

**Graylog AbuseIPDB Lookup** (« l'extension ») est un projet open source
publié sous licence MIT. Elle ne contient ni publicité, ni outil d'analyse
d'audience, ni télémétrie. Aucune donnée n'est envoyée au développeur.

## Données traitées

L'extension lit le contenu des pages web pour y trouver **un seul champ**,
configuré par l'utilisateur (par défaut `o365_audit_ClientIP`), dans les
tableaux et la vue détaillée de Graylog. Le reste de la page n'est ni lu,
ni conservé, ni transmis.

Pour chaque adresse IP **publique** trouvée dans ce champ, l'extension envoie
uniquement cette adresse IP à deux services tiers :

| Service | Données envoyées | Finalité | Politique de confidentialité |
| ------- | ---------------- | -------- | ---------------------------- |
| [AbuseIPDB](https://www.abuseipdb.com) | Adresse IP + clé API de l'utilisateur | Score de réputation, signalements, ISP, pays | [abuseipdb.com/privacy-policy](https://www.abuseipdb.com/privacy-policy) |
| [ipwho.is](https://ipwho.is) | Adresse IP | Ville et région | [ipwho.is](https://ipwho.is) |

Les adresses IP privées ou réservées (RFC 1918, loopback, link-local, ULA)
ne sont **jamais** envoyées.

Ces requêtes sont faites directement depuis le navigateur de l'utilisateur
vers ces services, sans intermédiaire.

## Données stockées

Les données suivantes sont conservées **uniquement dans le stockage local du
navigateur** (`storage.local`) et ne quittent jamais la machine :

- la clé API AbuseIPDB et les paramètres de l'extension ;
- le cache des résultats (24 h par défaut, désactivable, vidable depuis les
  paramètres) ;
- un compteur du nombre de requêtes AbuseIPDB par jour (7 derniers jours).

Toutes ces données sont supprimées lors de la désinstallation de
l'extension.

## Partage

Aucune donnée n'est vendue, partagée ni transmise à un tiers autre que les
deux services listés ci-dessus.

## Contact

Pour toute question : ouvrez un ticket sur
[github.com/eldriic/graylog-abuseipdb/issues](https://github.com/eldriic/graylog-abuseipdb/issues).

---

# Privacy Policy (English)

*Last updated: October 2, 2026*

**Graylog AbuseIPDB Lookup** ("the extension") is open-source software
released under the MIT license. It contains no ads, no analytics and no
telemetry. No data is ever sent to the developer.

## Data processed

The extension reads web page content to find **a single field**, configured
by the user (default `o365_audit_ClientIP`), in Graylog tables and message
details. The rest of the page is not read, stored or transmitted.

For each **public** IP address found in that field, the extension sends only
that IP address to two third-party services:

| Service | Data sent | Purpose | Privacy policy |
| ------- | --------- | ------- | -------------- |
| [AbuseIPDB](https://www.abuseipdb.com) | IP address + the user's API key | Reputation score, reports, ISP, country | [abuseipdb.com/privacy-policy](https://www.abuseipdb.com/privacy-policy) |
| [ipwho.is](https://ipwho.is) | IP address | City and region | [ipwho.is](https://ipwho.is) |

Private and reserved addresses (RFC 1918, loopback, link-local, ULA) are
**never** sent.

Requests go directly from the user's browser to these services.

## Data stored

The following is kept **only in the browser's local storage**
(`storage.local`) and never leaves the device:

- the AbuseIPDB API key and the extension settings;
- a cache of lookup results (24 h by default, can be disabled or cleared);
- a per-day count of AbuseIPDB requests (last 7 days).

All of it is deleted when the extension is removed.

## Sharing

No data is sold, shared or transferred to any third party other than the two
services listed above.

## Contact

Questions: open an issue at
[github.com/eldriic/graylog-abuseipdb/issues](https://github.com/eldriic/graylog-abuseipdb/issues).
