'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { _internals } = require('../blaulicht-sms-alarm');
const { DEFAULT_BASE_URL } = require('../lib/blaulicht-sms-client');
const { STAGING_BASE_URL } = require('../lib/blaulicht-sms-alarm-client');

function createRed() {
    let constructor;
    let registrationOptions;
    return {
        RED: {
            nodes: {
                createNode(node, config) {
                    const emitter = new EventEmitter();
                    node.on = emitter.on.bind(emitter);
                    node.emit = emitter.emit.bind(emitter);
                    node.credentials = config._credentials || {};
                    node.sent = [];
                    node.statuses = [];
                    node.errors = [];
                    node.send = (message) => node.sent.push(message);
                    node.status = (status) => node.statuses.push(status);
                    node.error = (message, msg) => node.errors.push({ message, msg });
                },
                registerType(_type, registeredConstructor, options) {
                    constructor = registeredConstructor;
                    registrationOptions = options;
                }
            }
        },
        getConstructor: () => constructor,
        getRegistrationOptions: () => registrationOptions
    };
}

function createNode({ config = {}, client } = {}) {
    const capturedOptions = [];
    const fakeClient = client || {
        async triggerAlarm(input) { return { result: 'OK', alarmId: 'a1', input }; },
        async queryAlarm(input) { return { result: 'OK', alarmId: input.alarmId }; },
        async listAlarms(input) { return { result: 'OK', alarms: [], input }; }
    };
    const red = createRed();
    const register = _internals.createRegistration({
        clientFactory(options) {
            capturedOptions.push(options);
            return fakeClient;
        },
        now: () => new Date('2026-07-29T12:00:00.000Z')
    });
    register(red.RED);
    const NodeConstructor = red.getConstructor();
    const node = new NodeConstructor({
        operation: 'trigger',
        environment: 'staging',
        liveTriggerEnabled: false,
        customerId: '100027',
        eventType: 'alarm',
        alarmText: 'Test',
        needsAcknowledgement: false,
        duration: 60,
        groupCodes: 'G1',
        template: '',
        _credentials: { username: 'trigger', password: 'secret' },
        ...config
    });
    return { node, fakeClient, capturedOptions, red };
}

function emitInput(node, msg = {}) {
    const sent = [];
    const doneCalls = [];
    return new Promise((resolve) => {
        node.emit('input', msg, (message) => sent.push(message), (error) => {
            doneCalls.push(error);
            resolve({ sent, doneCalls });
        });
    });
}

test('Alarm node defaults to the staging API client', () => {
    const { capturedOptions, red } = createNode();
    assert.equal(capturedOptions[0].baseUrl, STAGING_BASE_URL);
    assert.deepEqual(red.getRegistrationOptions().credentials, {
        username: { type: 'text' },
        password: { type: 'password' }
    });
});

test('live trigger is rejected without explicit confirmation', async () => {
    const { node } = createNode({ config: { environment: 'live', liveTriggerEnabled: false } });
    const result = await emitInput(node, { payload: { type: 'alarm', needsAcknowledgement: false } });

    assert.equal(result.sent.length, 0);
    assert.equal(result.doneCalls.length, 1);
    assert.equal(result.doneCalls[0].code, 'LIVE_TRIGGER_NOT_ENABLED');
    assert.deepEqual(node.statuses.at(-1), { fill: 'red', shape: 'ring', text: 'LIVE_TRIGGER_NOT_ENABLED' });
});

test('confirmed live trigger uses the live API and emits the response contract', async () => {
    const { node, capturedOptions } = createNode({
        config: { environment: 'live', liveTriggerEnabled: true }
    });
    const msg = { payload: { type: 'alarm', alarmText: 'Test', needsAcknowledgement: false }, requestId: 'r1' };
    const result = await emitInput(node, msg);

    assert.equal(capturedOptions[0].baseUrl, DEFAULT_BASE_URL);
    assert.equal(result.doneCalls[0], undefined);
    assert.equal(result.sent.length, 1);
    assert.equal(result.sent[0].topic, 'blaulichtsms/alarm/trigger');
    assert.equal(result.sent[0].requestId, 'r1');
    assert.equal(result.sent[0].payload.alarmId, 'a1');
    assert.deepEqual(result.sent[0].blaulichtSms, {
        operation: 'trigger',
        environment: 'live',
        receivedAt: '2026-07-29T12:00:00.000Z'
    });
});

test('query operation forwards msg.payload to the client', async () => {
    const { node } = createNode({ config: { operation: 'query' } });
    const result = await emitInput(node, { payload: { alarmId: 'alarm-42' } });

    assert.equal(result.sent[0].topic, 'blaulichtsms/alarm/query');
    assert.equal(result.sent[0].payload.alarmId, 'alarm-42');
});

test('ambiguous trigger failures are reported once with a dedicated code', async () => {
    const timeout = Object.assign(new Error('socket timed out'), { code: 'ETIMEDOUT', retryable: true });
    const client = {
        async triggerAlarm() { throw timeout; },
        async queryAlarm() { throw timeout; },
        async listAlarms() { throw timeout; }
    };
    const { node } = createNode({ client });
    const result = await emitInput(node, { payload: { type: 'alarm', needsAcknowledgement: false } });

    assert.equal(result.sent.length, 0);
    assert.equal(result.doneCalls.length, 1);
    assert.equal(result.doneCalls[0].code, 'TRIGGER_OUTCOME_UNKNOWN');
    assert.equal(node.errors.length, 0);
});

test('legacy input handling without done reports an error only through node.error', async () => {
    const error = Object.assign(new Error('bad credentials'), { code: 'ALARM_API_REQUEST_FAILED' });
    const client = {
        async triggerAlarm() { throw error; },
        async queryAlarm() { throw error; },
        async listAlarms() { throw error; }
    };
    const { node } = createNode({ client });

    await new Promise((resolve) => {
        node.emit('input', { payload: { type: 'alarm', needsAcknowledgement: false } }, () => {});
        setImmediate(resolve);
    });

    assert.equal(node.errors.length, 1);
    assert.equal(node.errors[0].message, 'bad credentials');
});

test('closing the node aborts an in-flight request', async () => {
    let receivedSignal;
    const client = {
        triggerAlarm(_input, { signal }) {
            receivedSignal = signal;
            return new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => {
                    const error = new Error('aborted');
                    error.name = 'AbortError';
                    reject(error);
                });
            });
        },
        async queryAlarm() {},
        async listAlarms() {}
    };
    const { node } = createNode({ client });
    const inputPromise = emitInput(node, { payload: { type: 'alarm', needsAcknowledgement: false } });
    await Promise.resolve();
    let closed = false;
    node.emit('close', false, () => { closed = true; });
    const result = await inputPromise;

    assert.equal(receivedSignal.aborted, true);
    assert.equal(closed, true);
    assert.equal(result.doneCalls[0], undefined);
});
