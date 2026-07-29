# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 1.x | Yes |
| 0.2.x and older | No |

## Reporting a vulnerability

Do not open a public issue for vulnerabilities involving credential disclosure, session-token handling, remote code execution, denial of service or unintended alarm-data exposure.

Prefer GitHub's private vulnerability reporting or contact the repository owner privately through GitHub. Include the affected version, Node-RED and Node.js versions, reproducible steps using synthetic data, the impact and a proposed mitigation when available.

Never include live dashboard credentials, session tokens, customer IDs, phone numbers or real incident data.

## Security model

- Dashboard credentials and session tokens are stored through Node-RED credentials.
- The package communicates only with the official HTTPS blaulichtSMS API endpoint.
- The package has no runtime dependencies.
- Responses are size-limited and parsed as JSON.
- Network requests have a timeout and are aborted when the node stops.
- Errors are reported without intentionally including secrets.

Operators remain responsible for securing the Node-RED editor, credential encryption, host system and network access.
