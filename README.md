# node-red-contrib-blaulicht-sms

[![CI](https://github.com/riederch/node-red-contrib-blaulicht-sms/actions/workflows/ci.yml/badge.svg)](https://github.com/riederch/node-red-contrib-blaulicht-sms/actions/workflows/ci.yml)
[![CodeQL](https://github.com/riederch/node-red-contrib-blaulicht-sms/actions/workflows/codeql.yml/badge.svg)](https://github.com/riederch/node-red-contrib-blaulicht-sms/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Production-oriented Node-RED nodes for the blaulichtSMS Dashboard API and Alarm API.

> **Release status:** `1.0.0-rc.1` is a release candidate. Real Dashboard, staging Alarm API and controlled live-trigger validation are still required before stable `1.0.0`.
>
> **Independent community project:** This package is not developed, endorsed or supported by blaulichtSMS.

[Deutsche Dokumentation](README.de.md)

## Nodes

### blaulichtSMS Dashboard

Input node `bl-sms-dash` for receiving dashboard data, alarms and infos. It supports dashboard credentials or an existing session token, automatic session renewal, change filtering and controlled retry backoff.

### blaulichtSMS Alarm API

Output node `bl-sms-alarm` for the documented Alarm API V1.5 operations:

- `trigger`: trigger an alarm or info
- `query`: retrieve one alarm by `alarmId`
- `list`: list up to 100 alarms for one or more customer IDs

The node supports both the official live and staging API environments. Automatic alarm trigger credentials are stored in Node-RED's credential store.

## Requirements

- Node.js 18 or newer
- Node-RED 4.0 or newer
- A configured blaulichtSMS dashboard for the Dashboard node
- A configured automatic alarm trigger for the Alarm API node
- Network access to the selected blaulichtSMS API

## Installation

For the release candidate, install from GitHub:

```bash
cd ~/.node-red
npm install github:riederch/node-red-contrib-blaulicht-sms#update/blaulichtsms-dashboard-api-modernization
```

After npm publication, the package can be installed through the Node-RED Palette Manager or with:

```bash
npm install node-red-contrib-blaulicht-sms@next
```

## Dashboard output

The original Dashboard API response remains unchanged in `msg.payload`:

```js
msg.topic = 'blaulichtsms/dashboard';
msg.payload = { customerId: '123456', integrations: [], alarms: [], infos: [] };
msg.blaulichtSms = { receivedAt: '2026-07-29T11:00:00.000Z', changed: true };
```

## Alarm API input

`msg.payload` contains the request without username and password.

### Trigger

```js
msg.payload = {
  customerId: '100027',
  type: 'alarm',
  alarmText: 'Fire alarm',
  needsAcknowledgement: true,
  duration: 60,
  groupCodes: ['G1'],
  coordinates: { lat: 46.61, lon: 13.85 }
};
```

All documented optional fields are supported: `hideTriggerDetails`, `indexNumber`, `startDate`, `recipientConfirmation`, `recipientConfirmationTarget`, `template`, `additionalMsisdns`, `coordinates` and `geolocation`.

### Query

```js
msg.payload = { customerId: '100027', alarmId: '...' };
```

### List

```js
msg.payload = {
  customerIds: ['100027'],
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-12-31T23:59:59.999Z'
};
```

Successful results are emitted with topics `blaulichtsms/alarm/trigger`, `blaulichtsms/alarm/query` or `blaulichtsms/alarm/list`.

## Trigger safety

Staging is the default environment. A live `trigger` is rejected until the operator explicitly confirms live alarm triggering in the node configuration.

A trigger request is sent exactly once and is **never retried automatically**, because a timeout or broken connection can happen after blaulichtSMS has already accepted the alarm. An ambiguous transport failure is reported as `TRIGGER_OUTCOME_UNKNOWN`. Use `query` or `list` before deciding whether another trigger is safe.

## Upgrade from 0.2.0

The Dashboard node type remains `bl-sms-dash`; existing flows continue to load. Open and save existing nodes once after upgrading so legacy secrets are transferred to Node-RED's credential store.

## Development

```bash
npm test
npm run test:coverage
npm run check
npm pack --dry-run
```

See [Architecture](docs/ARCHITECTURE.md), [Changelog](CHANGELOG.md), [Contributing](CONTRIBUTING.md) and [Security](SECURITY.md).

## License

MIT © Christoph Rieder
