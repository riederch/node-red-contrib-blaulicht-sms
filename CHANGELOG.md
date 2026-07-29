# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog and the project follows Semantic Versioning.

## [Unreleased]

### Planned

- Real-world validation against a dedicated blaulichtSMS test dashboard
- npm publication and Node-RED Flow Library submission
- Optional separate Alarm API output node after a dedicated security and UX design

## [1.0.0] - 2026-07-29

### Added

- Dedicated, dependency-free Dashboard API client
- Credential-store support for tokens, usernames and passwords
- Automatic session renewal after HTTP 401 for credential login
- Request timeout, response size limit and request cancellation
- Exponential retry backoff and duplicate error suppression
- Stable output metadata in `msg.topic` and `msg.blaulichtSms`
- Unit and integration-style tests using the Node.js test runner
- GitHub Actions CI and CodeQL workflows
- Example flow, architecture documentation, contribution guide and security policy
- English and German documentation

### Changed

- Minimum supported Node-RED version is 4.0
- Package metadata and repository links were corrected
- The node uses a stock Font Awesome icon instead of a missing custom image
- Polling uses completion-based scheduling to prevent overlapping requests
- Dashboard response comparison now uses deep structural equality

### Security

- Secrets are no longer stored in exported flow JSON for newly saved nodes
- Network and parse errors no longer escape as uncaught exceptions
- Large API responses are rejected before unbounded buffering

### Compatibility

- Node type remains `bl-sms-dash`
- `msg.payload` remains the unmodified Dashboard API response
- Legacy 0.2.0 configuration fields remain supported during migration

## [0.2.0] - 2021-12-02

- Previous manually distributed release
