# Release checklist

## Automated checks

- [ ] CI passes on Node.js 18, 20, 22 and 24
- [ ] CodeQL passes
- [ ] All API-client and Node-RED adapter tests pass
- [ ] `npm run check` passes
- [ ] `npm pack --dry-run` contains both node pairs, clients, documentation and examples
- [ ] No custom icon is referenced without a packaged file

## Clean Node-RED installation

Perform the following with the generated tarball, not a repository checkout.

### Node-RED 4

- [ ] Install in a clean Node-RED 4 user directory
- [ ] Start Node-RED without load errors
- [ ] Confirm both nodes appear in the palette
- [ ] Open, save and deploy both node editors
- [ ] Confirm credentials are absent from an exported flow

### Node-RED 5

- [ ] Repeat the installation and editor checks with Node-RED 5
- [ ] Confirm Dashboard polling and Alarm API operations behave identically

## Dashboard API validation

Use a dedicated test dashboard.

- [ ] Login using Dashboard credentials
- [ ] Login using a session token
- [ ] Receive an alarm and an info object
- [ ] Verify changes-only suppression
- [ ] Verify automatic session renewal after HTTP 401
- [ ] Verify DNS/network failure handling and recovery
- [ ] Redeploy while a request is active and verify clean cancellation

## Alarm API staging validation

Use an automatic alarm trigger configured for the official staging environment.

- [ ] Trigger an `info` without acknowledgement
- [ ] Trigger an `alarm` with acknowledgement and duration
- [ ] Trigger using a template and group codes
- [ ] Trigger using coordinates
- [ ] Trigger using geolocation address
- [ ] Query the returned `alarmId`
- [ ] List alarms for the test customer
- [ ] Verify invalid credentials produce a structured error
- [ ] Verify an invalid group produces `INVALID_GROUP`
- [ ] Verify an invalid template produces `INVALID_TEMPLATE`

## Controlled live validation

Use an authorized low-impact test group and coordinate the test with recipients.

- [ ] Confirm live triggering is rejected without explicit enablement
- [ ] Enable live triggering deliberately
- [ ] Send one clearly marked test information event
- [ ] Query or list the event to confirm receipt
- [ ] Disable live triggering again after the test

## Ambiguous trigger outcome

- [ ] Simulate or reproduce a transport interruption after request transmission
- [ ] Confirm the node reports `TRIGGER_OUTCOME_UNKNOWN`
- [ ] Confirm no automatic retry occurs
- [ ] Verify the alarm state through `query` or `list` before any manual retry

## Publication

- [ ] Replace the release-candidate version with `1.0.0`
- [ ] Remove `publishConfig.tag = next` or publish stable with the `latest` tag
- [ ] Update the changelog with completed validation
- [ ] Merge the release PR
- [ ] Create an annotated Git tag
- [ ] Publish the exact tested tarball to npm
- [ ] Install the published package in a fresh Node-RED instance
- [ ] Submit or refresh the package in the Node-RED Flow Library
