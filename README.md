# node-red-contrib-blaulicht-sms

[![CI](https://github.com/riederch/node-red-contrib-blaulicht-sms/actions/workflows/ci.yml/badge.svg)](https://github.com/riederch/node-red-contrib-blaulicht-sms/actions/workflows/ci.yml)
[![CodeQL](https://github.com/riederch/node-red-contrib-blaulicht-sms/actions/workflows/codeql.yml/badge.svg)](https://github.com/riederch/node-red-contrib-blaulicht-sms/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-oriented Node-RED input node for receiving alarms and information from the [blaulichtSMS Dashboard API](https://github.com/blaulichtSMS/docs/blob/master/dashboard_api_v1.md).

> **Independent community project:** This package is not developed, endorsed or supported by blaulichtSMS. It reads dashboard data; it does not trigger alarms.

[Deutsche Dokumentation](README.de.md)

## What it does

The `blaulichtSMS` node signs in to a configured blaulichtSMS dashboard, polls the documented Dashboard API and emits the current response into a Node-RED flow.

Typical uses include updating an incident display, switching local displays or lighting, forwarding alarm data, extracting geolocation and acknowledgement data, and local archiving or analysis.

## Requirements

- Node.js 18 or newer
- Node-RED 4.0 or newer
- A dashboard configured in the blaulichtSMS web platform
- Network access to `api.blaulichtsms.net`

## Installation

After npm publication, install through the Node-RED Palette Manager or in the Node-RED user directory:

```bash
cd ~/.node-red
npm install node-red-contrib-blaulicht-sms
```

For testing the current GitHub version:

```bash
cd ~/.node-red
npm install github:riederch/node-red-contrib-blaulicht-sms
```

## Configuration

| Field | Description |
|---|---|
| Authentication | Dashboard credentials or an existing API session token |
| Customer ID | blaulichtSMS customer ID; required for credential login |
| Username | Username of the configured dashboard |
| Password | Dashboard password |
| Session token | Existing Dashboard API session ID; cannot be renewed automatically |
| Poll interval | Polling interval in seconds, from 5 to 86,400 |
| Changes only | Emit only when the complete Dashboard API response changes |
| Name | Optional label in the Node-RED workspace |

Credentials and tokens are stored through the Node-RED credential system and are not included in exported flow JSON.

## Output contract

The API response remains unchanged in `msg.payload` for compatibility:

```js
msg = {
  topic: 'blaulichtsms/dashboard',
  payload: {
    customerId: '123456',
    customerName: 'FF Test',
    username: 'dashboard',
    integrations: [],
    alarms: [],
    infos: []
  },
  blaulichtSms: {
    receivedAt: '2026-07-29T11:00:00.000Z',
    changed: true
  }
};
```

## Reliability behaviour

- Immediate first poll after deployment
- No overlapping requests
- Automatic session renewal after HTTP 401 for credential login
- 15-second request timeout and 5 MiB response limit
- Controlled handling of DNS, network, HTTP and JSON errors
- Duplicate error suppression and exponential retry backoff up to five minutes
- Active request cancellation when the node is stopped or redeployed

Use a Node-RED **Catch** node when the flow should react to connection or authentication failures.

## Upgrade from 0.2.0

The node type remains `bl-sms-dash`; existing flows continue to load. The runtime supports the legacy fields `kid`, `user`, `password`, `token` and `timer`.

After upgrading, open every existing node, verify authentication and interval, save it once and deploy the flow. This migrates secrets into Node-RED's credential store.

## Scope

Version 1 focuses on reliable **Dashboard API reception**. Active alarm triggering through the separate blaulichtSMS Alarm API belongs in a distinct output node with explicit safeguards.

See [Architecture](docs/ARCHITECTURE.md), [Changelog](CHANGELOG.md), [Contributing](CONTRIBUTING.md) and [Security](SECURITY.md).

## Development

```bash
npm test
npm run test:coverage
npm run check
npm pack --dry-run
```

The package has no runtime dependencies. Tests use the Node.js built-in test runner and mocked HTTPS and Node-RED interfaces.

## License

MIT © Christoph Rieder
