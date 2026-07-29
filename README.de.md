# node-red-contrib-blaulicht-sms

Ein robust ausgelegter Node-RED-Eingangsnode zum Empfangen von Alarmen und Informationen über die offizielle [blaulichtSMS Dashboard API](https://github.com/blaulichtSMS/docs/blob/master/dashboard_api_v1.md).

> **Unabhängiges Community-Projekt:** Dieses Paket wird nicht von blaulichtSMS entwickelt, unterstützt oder freigegeben. Es liest Dashboard-Daten und löst keine Alarmierungen aus.

## Zweck

Der Node meldet sich an einem in blaulichtSMS eingerichteten Dashboard an, fragt regelmäßig die dokumentierte Dashboard API ab und übergibt die Antwort an einen Node-RED-Flow.

Typische Anwendungen sind Einsatzmonitore, lokale Schaltungen, Weitergabe von Alarmdaten, Auswertung von Geodaten und Rückmeldungen sowie lokale Archivierung.

## Voraussetzungen

- Node.js ab Version 18
- Node-RED ab Version 4.0
- Ein eingerichtetes blaulichtSMS-Dashboard
- Netzwerkzugriff auf `api.blaulichtsms.net`

## Konfiguration

Zugangsdaten oder ein vorhandenes Session-Token können verwendet werden. Das Abfrageintervall liegt zwischen 5 und 86.400 Sekunden. Mit **Nur Änderungen** werden unveränderte Antworten nicht erneut ausgegeben.

Zugangsdaten und Token werden im Credential-Store von Node-RED gespeichert und nicht mit exportierten Flows ausgegeben.

## Ausgabe

Die API-Antwort bleibt unverändert in `msg.payload`. Zusätzlich setzt der Node:

- `msg.topic = "blaulichtsms/dashboard"`
- `msg.blaulichtSms.receivedAt`
- `msg.blaulichtSms.changed`

## Betriebssicherheit

- sofortige erste Abfrage,
- keine parallelen Requests,
- automatische Session-Erneuerung nach HTTP 401 bei Zugangsdaten,
- Timeout und Größenlimit,
- kontrollierte Behandlung von DNS-, Netzwerk-, HTTP- und JSON-Fehlern,
- exponentielles Retry-Backoff,
- Abbruch laufender Requests beim Stoppen oder Deployment.

## Upgrade von 0.2.0

Der Node-Typ `bl-sms-dash` bleibt erhalten. Alte Felder werden zur Laufzeit unterstützt. Nach dem Upgrade jeden bestehenden Node öffnen, prüfen, speichern und deployen, damit Geheimnisse in den Credential-Store übernommen werden.

## Abgrenzung

Das aktive Auslösen von Alarmen über die separate Alarm API gehört in einen eigenen Output-Node mit klaren Schutzmechanismen.

Weitere Informationen: [README](README.md), [Architektur](docs/ARCHITECTURE.md), [Changelog](CHANGELOG.md), [Mitwirken](CONTRIBUTING.md), [Sicherheit](SECURITY.md).
