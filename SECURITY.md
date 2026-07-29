# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 1.x | Yes |
| 0.2.x and older | No |

## Reporting a vulnerability

Do not open a public issue for vulnerabilities involving credential disclosure, session-token handling, unintended alarm triggering, remote code execution, denial of service or alarm-data exposure.

Prefer GitHub's private vulnerability reporting or contact the repository owner privately through GitHub. Include the affected version, Node-RED and Node.js versions, reproducible steps using synthetic data, the impact and a proposed mitigation when available.

Never include live Dashboard credentials, Alarm API credentials, session tokens, customer IDs, phone numbers, group codes or real incident data.

## Security model

- Dashboard credentials, session tokens and automatic-alarm-trigger credentials are stored through Node-RED credentials.
- The package communicates only with the configured official HTTPS blaulichtSMS live or staging endpoint.
- The package has no runtime dependencies.
- Responses are size-limited and parsed as JSON.
- Network requests have a timeout and are aborted when a node stops.
- Errors are reported without intentionally including credentials or request secrets.
- Staging is the default environment for the Alarm API output node.
- Live `trigger` operations require explicit confirmation in the node configuration.
- Trigger requests are never retried automatically.
- Ambiguous trigger transport failures are reported as `TRIGGER_OUTCOME_UNKNOWN` because the alarm may already have been accepted.

## Operational responsibilities

The operator remains responsible for:

- securing the Node-RED editor and admin API,
- configuring `credentialSecret` and protecting the Node-RED user directory,
- limiting who may deploy or inject messages into alarm-triggering flows,
- restricting network access to Node-RED and the host system,
- testing flows against staging before enabling live triggering,
- using dedicated low-impact test groups for controlled live tests,
- reviewing Node-RED flow and audit logs after alarm operations,
- verifying an uncertain trigger through `query` or `list` before sending another trigger.

Do not expose an Alarm API trigger flow directly to unauthenticated HTTP, MQTT or other external inputs without additional authorization, validation and rate limiting.
