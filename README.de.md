# node-red-contrib-blaulicht-sms

Produktionsorientierte Node-RED-Nodes für die blaulichtSMS Dashboard API und Alarm API.

> **Unabhängiges Community-Projekt:** Dieses Paket wird nicht von blaulichtSMS entwickelt, freigegeben oder unterstützt.

## Enthaltene Nodes

### blaulichtSMS Dashboard

Der Eingangsnode `bl-sms-dash` meldet sich an einem eingerichteten blaulichtSMS-Dashboard an und übergibt Alarme, Informationen und Dashboard-Daten an einen Node-RED-Flow.

Funktionen:

- Zugang über Dashboard-Zugangsdaten oder Session-Token,
- automatische Session-Erneuerung nach HTTP 401,
- konfigurierbares Abfrageintervall,
- Ausgabe nur bei Änderungen,
- kontrollierter Retry mit exponentiellem Backoff,
- Abbruch laufender Requests beim Redeploy.

### blaulichtSMS Alarm API

Der Ausgangsnode `bl-sms-alarm` unterstützt die dokumentierte Alarm API V1.5:

- `trigger`: Alarm oder Information auslösen,
- `query`: einen Alarm über seine `alarmId` abfragen,
- `list`: bis zu 100 Alarme für eine oder mehrere Kundennummern auflisten.

Die Zugangsdaten des automatischen Alarmauslösers werden im Credential-Store von Node-RED gespeichert.

## Voraussetzungen

- Node.js ab Version 18
- Node-RED ab Version 4.0
- Für den Dashboard-Node: eingerichtetes blaulichtSMS-Dashboard
- Für den Alarm-Node: bei blaulichtSMS eingerichteter automatischer Alarmauslöser
- Netzwerkzugriff auf die gewählte blaulichtSMS-API-Umgebung

## Dashboard-Ausgabe

Die API-Antwort bleibt unverändert in `msg.payload`. Zusätzlich setzt der Node:

```js
msg.topic = "blaulichtsms/dashboard";
msg.blaulichtSms = {
    receivedAt: "2026-07-29T12:00:00.000Z",
    changed: true
};
```

## Alarm-API-Eingabe

`msg.payload` enthält die operationsspezifischen Daten ohne Benutzername und Passwort.

### Alarm auslösen

```js
msg.payload = {
    customerId: "100027",
    type: "alarm",
    alarmText: "Brandmeldealarm Lagerhalle",
    needsAcknowledgement: true,
    duration: 60,
    groupCodes: ["G1"],
    coordinates: { lat: 46.61, lon: 13.85 }
};
```

### Alarm abfragen

```js
msg.payload = {
    customerId: "100027",
    alarmId: "..."
};
```

### Alarme auflisten

```js
msg.payload = {
    customerIds: ["100027"],
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-12-31T23:59:59.999Z"
};
```

## Schutz bei Live-Alarmierung

Die Staging-Umgebung ist die Voreinstellung. Ein `trigger` gegen die Live-Umgebung wird nur ausgeführt, wenn im Node ausdrücklich bestätigt wurde, dass damit reale Alarmierungen ausgelöst werden können.

Trigger-Aufrufe werden niemals automatisch wiederholt. Bei einem Timeout oder Verbindungsabbruch kann der Alarm bereits angenommen worden sein. In diesem Fall wird `TRIGGER_OUTCOME_UNKNOWN` gemeldet. Vor einem erneuten Trigger muss der Zustand mit `query` oder `list` geprüft werden.

## Fehlerbehandlung

API-Resultcodes wie `INVALID_GROUP`, `INVALID_TEMPLATE` oder `NOT_AUTHORIZED` werden als strukturierte Fehler an Node-RED weitergegeben. Für die Verarbeitung im Flow kann ein Catch-Node verwendet werden.

## Upgrade von 0.2.0

Der Dashboard-Node-Typ `bl-sms-dash` bleibt erhalten. Alte Konfigurationsfelder werden zur Laufzeit unterstützt. Nach dem Upgrade jeden bestehenden Dashboard-Node öffnen, prüfen, speichern und deployen, damit Geheimnisse in den Credential-Store übernommen werden.

Weitere Informationen: [englische README](README.md), [Architektur](docs/ARCHITECTURE.md), [Changelog](CHANGELOG.md), [Mitwirken](CONTRIBUTING.md), [Sicherheit](SECURITY.md).
