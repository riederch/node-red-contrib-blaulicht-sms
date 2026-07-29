# node-red-contrib-blaulicht-sms

Node-RED integration for the [blaulichtSMS Dashboard API](https://github.com/blaulichtSMS/docs/blob/master/dashboard_api_v1.md).

The node polls a blaulichtSMS dashboard and emits its current data as `msg.payload`. This includes customer information, integrations, alarms and infos.

## Requirements

- Node.js 18 or newer
- Node-RED 3.0 or newer
- A dashboard configured in the blaulichtSMS web platform

## Installation

Install from the Node-RED palette or from the command line in your Node-RED user directory:

```bash
npm install node-red-contrib-blaulicht-sms
```

To install directly from GitHub:

```bash
npm install github:riederch/node-red-contrib-blaulicht-sms
```

Restart Node-RED after installation.

## Configuration

The node supports both authentication methods accepted by the Dashboard API:

1. **Session token**: use an existing Dashboard API session ID.
2. **Dashboard credentials**: customer ID, dashboard username and password. The node logs in automatically and renews an expired session after an HTTP 401 response.

The polling interval is configured in seconds with a minimum of 5 seconds. With **Changes only** enabled, the node emits a message only when the complete API response changes.

Credentials and tokens are stored through Node-RED's credential system rather than in the exported flow JSON.

## Output

```js
msg.payload = {
  customerId: '123456',
  customerName: 'FF Test',
  username: 'dashboard',
  integrations: [],
  alarms: [],
  infos: []
};
```

The exact object structures are documented in the official [Dashboard API V1 documentation](https://github.com/blaulichtSMS/docs/blob/master/dashboard_api_v1.md).

## Upgrade from 0.2.0

The node type remains `bl-sms-dash`, so existing flows continue to load. Legacy configuration fields are read as a compatibility fallback. Open and save each existing node once to move the token or password into Node-RED's protected credential store and to use the renamed configuration fields.

## Development

```bash
npm test
npm run check
npm pack --dry-run
```

## License

MIT
