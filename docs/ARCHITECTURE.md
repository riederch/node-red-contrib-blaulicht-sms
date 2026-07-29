# Architecture

## Goal

Provide a small, predictable and resilient bridge from the blaulichtSMS Dashboard API into Node-RED without turning the node into a general-purpose API client.

## Components

### `blaulicht-sms-dash.js`

The Node-RED adapter reads and migrates configuration, resolves credentials, schedules polls, applies retry backoff, suppresses duplicate output, publishes the message contract and stops timers and active requests during redeploy.

### `lib/blaulicht-sms-client.js`

The protocol client handles HTTPS, timeouts, response limits, JSON parsing, login, session renewal after HTTP 401, typed errors and basic response validation. It contains no Node-RED-specific code.

## Authentication

Dashboard credentials are exchanged for a session ID and can be renewed once after HTTP 401. A manually supplied session token is used directly and cannot be renewed automatically. Secrets are read from `node.credentials`; legacy fields exist only as migration fallbacks.

## Poll lifecycle

1. Schedule an immediate poll.
2. Create an `AbortController`.
3. Request dashboard data.
4. Emit according to the changes-only setting.
5. Schedule the next poll after completion.
6. Retry failures with exponential backoff.
7. On close, cancel the timer and abort the request.

Completion-based scheduling prevents overlapping requests.

## Output contract

`msg.payload` is the unmodified API response. Additive metadata is provided in `msg.topic`, `msg.blaulichtSms.receivedAt` and `msg.blaulichtSms.changed`.

## Future nodes

An Alarm API sender must be a separate output node. Its security model, message contract and operational consequences differ substantially from the dashboard input node.
