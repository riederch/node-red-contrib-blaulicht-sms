# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog and the project follows Semantic Versioning.

## [Unreleased]

### Release validation still required

- Real Dashboard API test with a dedicated test dashboard
- Alarm API `trigger`, `query` and `list` test against the official staging environment
- Controlled live trigger test with an authorized test group
- Installation smoke test in clean Node-RED 4 and Node-RED 5 environments
- npm publication and Node-RED Flow Library submission

## [1.0.0] - 2026-07-29

### Added

- Dedicated, dependency-free Dashboard API client
- Separate Alarm API V1.5 client and `bl-sms-alarm` output node
- Alarm API operations `trigger`, `query` and `list`
- Official live and staging API environments
- Explicit live-trigger confirmation with staging as the default
- Dedicated `TRIGGER_OUTCOME_UNKNOWN` error for ambiguous trigger failures
- Validation for acknowledgement duration, ISO dates, group codes, telephone numbers, coordinates and geolocation
- Credential-store support for Dashboard and automatic-alarm-trigger secrets
- Automatic Dashboard session renewal after HTTP 401
- Request timeout, response size limit and request cancellation
- Exponential Dashboard retry backoff and duplicate error suppression
- Stable output metadata in `msg.topic` and `msg.blaulichtSms`
- API-client and Node-RED runtime tests using the Node.js test runner
- GitHub Actions CI and CodeQL workflows
- Example flow, architecture documentation, contribution guide and security policy
- English and German documentation

### Changed

- Minimum supported Node-RED version is 4.0
- Package metadata and repository links were corrected
- Both nodes use bundled Node-RED Font Awesome icons
- Dashboard polling uses completion-based scheduling to prevent overlapping requests
- Dashboard response comparison uses deep structural equality
- Alarm trigger requests are sent exactly once and are never retried automatically
- Alarm-node errors are reported once through the Node-RED `done(error)` contract

### Security

- Secrets are no longer stored in exported flow JSON for newly saved nodes
- Live triggering is disabled until explicitly confirmed in the node configuration
- Network and parse errors no longer escape as uncaught exceptions
- Large API responses are rejected before unbounded buffering
- Running requests are aborted when nodes are stopped or redeployed

### Compatibility

- Dashboard node type remains `bl-sms-dash`
- Dashboard `msg.payload` remains the unmodified API response
- Legacy 0.2.0 Dashboard configuration fields remain supported during migration

## [0.2.0] - 2021-12-02

- Previous manually distributed release
