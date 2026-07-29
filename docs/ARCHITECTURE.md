# Architecture

## Goal

Provide predictable Node-RED integrations for two distinct blaulichtSMS use cases:

1. receiving Dashboard API data,
2. explicitly calling Alarm API operations.

The protocol clients are independent from Node-RED so validation, transport and error handling can be tested without a running editor.

## Components

### `blaulicht-sms-dash.js`

Node-RED input adapter for configuration migration, credentials, completion-based polling, retry backoff, duplicate-output suppression, status reporting and clean shutdown.

### `lib/blaulicht-sms-client.js`

Shared HTTPS transport and Dashboard API client. It implements timeouts, response limits, JSON parsing, typed errors, login and one-time session renewal after HTTP 401.

### `blaulicht-sms-alarm.js`

Node-RED output adapter for Alarm API operations. It dispatches `trigger`, `query` and `list`, prevents parallel requests, applies live-trigger safeguards, publishes operation metadata and aborts active requests during redeploy.

### `lib/blaulicht-sms-alarm-client.js`

Alarm API V1.5 client. It validates request objects, adds automatic-alarm-trigger credentials, calls the documented endpoints and exposes API result codes as typed errors.

## Dashboard lifecycle

1. Schedule an immediate poll.
2. Create an `AbortController`.
3. Sign in when required and request dashboard data.
4. Emit according to the changes-only setting.
5. Schedule the next poll after completion.
6. Retry failures with exponential backoff.
7. On close, cancel the timer and abort the request.

Completion-based scheduling prevents overlapping requests.

## Alarm operation lifecycle

1. Resolve the configured operation and environment.
2. Reject unconfirmed live `trigger` operations before network access.
3. Validate `msg.payload` or configured trigger defaults.
4. Send exactly one request.
5. Emit the API result with operation metadata.
6. Report API and validation errors through the Node-RED `done(error)` contract.
7. Abort an active request when the node stops.

## Trigger safety model

Staging is the default environment. Live triggering requires an explicit persisted confirmation in the node configuration.

Trigger requests are never retried automatically. A timeout or broken connection can occur after the server accepted the alarm. Retryable transport failures during a trigger are therefore mapped to `TRIGGER_OUTCOME_UNKNOWN`. The operator must use `query` or `list` before deciding whether another trigger is safe.

This avoids pretending that an ambiguous network result is a confirmed failure.

## Credentials

Dashboard credentials, Dashboard session tokens and Alarm API automatic-trigger credentials are stored through Node-RED credentials. Legacy Dashboard fields exist only as migration fallbacks.

## Message contracts

### Dashboard

`msg.payload` remains the unmodified Dashboard API response. Additive metadata is provided in `msg.topic` and `msg.blaulichtSms`.

### Alarm API

The input request is read from `msg.payload`. The successful API result replaces `msg.payload`; other incoming message properties are preserved. Metadata records the operation, selected environment and response timestamp.
