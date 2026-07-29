# Contributing

Thank you for improving `node-red-contrib-blaulicht-sms`.

## Before opening an issue

- Remove customer IDs, usernames, passwords, session tokens, phone numbers and real alarm content.
- Check existing issues and the changelog.
- For security vulnerabilities, follow `SECURITY.md` instead of opening a public issue.

## Development setup

Requirements:

- Node.js 18 or newer
- npm

Run:

```bash
npm test
npm run test:coverage
npm run check
npm pack --dry-run
```

No live blaulichtSMS account is required for the automated tests. HTTP and Node-RED runtime interactions are mocked.

## Design rules

- Keep each node focused on one task.
- Preserve the existing `bl-sms-dash` type and `msg.payload` contract unless a major release explicitly documents a breaking change.
- Store secrets only through Node-RED credentials.
- Catch all asynchronous network errors.
- Do not add runtime dependencies unless the benefit clearly outweighs the supply-chain and maintenance cost.
- Do not log credentials, session tokens, complete recipient lists or real alarm text.
- New behaviour requires tests and user-facing documentation.
- Alarm triggering must remain separate from the dashboard input node.

## Pull requests

A pull request should contain:

- a concise problem statement,
- the chosen approach,
- compatibility implications,
- tests for changed behaviour,
- documentation and changelog updates,
- confirmation that `npm test`, `npm run check` and `npm pack --dry-run` pass.

Keep commits focused and use clear imperative commit messages.
