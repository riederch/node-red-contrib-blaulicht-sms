'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { _internals } = require('../blaulicht-sms-dash');

function createScheduler() {
    const tasks = [];
    return {
        tasks,
        setTimeoutFn(fn, delay) {
            const task = { fn, delay, cancelled: false };
            tasks.push(task);
            return task;
        },
        clearTimeoutFn(task) {
            task.cancelled = true;
        },
        async runNext() {
            const task = tasks.shift();
            assert.ok(task, 'Expected a scheduled task');
            if (!task.cancelled) {
                await task.fn();
            }
            return task;
        }
    };
}

function createRed() {
    let constructor;
    let registrationOptions;
    return {
        RED: {
            nodes: {
                createNode(node, config) {
                    const emitter = new EventEmitter();
                    node.on = emitter.on.bind(emitter);
                    node.once = emitter.once.bind(emitter);
                    node.emit = emitter.emit.bind(emitter);
                    node.credentials = config._credentials || {};
                    node.sent = [];
                    node.statuses = [];
                    node.errors = [];
                    node.send = (message) => node.sent.push(message);
                    node.status = (status) => node.statuses.push(status);
                    node.error = (message) => node.errors.push(message);
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

function createNode({ responses, config = {}, now } = {}) {
    const scheduler = createScheduler();
    const fakeClient = {
        calls: 0,
        async getDashboard() {
            const response = responses[this.calls++];
            if (response instanceof Error) {
                throw response;
            }
            return response;
        }
    };
    const red = createRed();
    const register = _internals.createRegistration({
        clientFactory: () => fakeClient,
        setTimeoutFn: scheduler.setTimeoutFn,
        clearTimeoutFn: scheduler.clearTimeoutFn,
        now: now || (() => new Date('2026-07-29T11:00:00.000Z'))
    });
    register(red.RED);
    const NodeConstructor = red.getConstructor();
    const node = new NodeConstructor({
        authType: 'credentials',
        customerId: '123456',
        interval: 5,
        updateOnly: true,
        _credentials: { username: 'dashboard', password: 'secret' },
        ...config
    });
    return { node, scheduler, fakeClient, red };
}

test('configuration parsing supports legacy fields', () => {
    const resolved = _internals.resolveConfiguration({
        kid: 123456,
        user: 'legacy-user',
        password: 'legacy-password',
        timer: 15,
        updateOnly: 'true'
    });

    assert.equal(resolved.authType, 'credentials');
    assert.equal(resolved.customerId, '123456');
    assert.equal(resolved.username, 'legacy-user');
    assert.equal(resolved.intervalSeconds, 15);
    assert.equal(resolved.updateOnly, true);
});

test('invalid poll intervals fall back to ten seconds', () => {
    assert.equal(_internals.parseIntervalSeconds(4), 10);
    assert.equal(_internals.parseIntervalSeconds(5), 5);
    assert.equal(_internals.parseIntervalSeconds('12'), 12);
    assert.equal(_internals.parseIntervalSeconds(86401), 10);
});

test('retry delay grows exponentially and is capped', () => {
    assert.equal(_internals.calculateRetryDelay(5000, 1), 5000);
    assert.equal(_internals.calculateRetryDelay(5000, 2), 10000);
    assert.equal(_internals.calculateRetryDelay(5000, 4), 40000);
    assert.equal(_internals.calculateRetryDelay(60000, 10), 300000);
});

test('the node emits a stable message contract and suppresses duplicates', async () => {
    const first = { customerId: '123456', alarms: [], infos: [], integrations: [] };
    const second = { customerId: '123456', alarms: [{ alarmId: 'a1' }], infos: [], integrations: [] };
    const { node, scheduler } = createNode({ responses: [first, first, second] });

    assert.equal(scheduler.tasks[0].delay, 0);
    await scheduler.runNext();
    assert.equal(node.sent.length, 1);
    assert.equal(node.sent[0].topic, 'blaulichtsms/dashboard');
    assert.equal(node.sent[0].payload, first);
    assert.deepEqual(node.sent[0].blaulichtSms, {
        receivedAt: '2026-07-29T11:00:00.000Z',
        changed: true
    });
    assert.equal(scheduler.tasks[0].delay, 5000);

    await scheduler.runNext();
    assert.equal(node.sent.length, 1);

    await scheduler.runNext();
    assert.equal(node.sent.length, 2);
    assert.equal(node.sent[1].payload, second);
});

test('identical errors are logged once while retries back off', async () => {
    const firstError = Object.assign(new Error('getaddrinfo EAI_AGAIN'), { code: 'EAI_AGAIN' });
    const secondError = Object.assign(new Error('getaddrinfo EAI_AGAIN'), { code: 'EAI_AGAIN' });
    const success = { customerId: '123456', alarms: [], infos: [] };
    const { node, scheduler } = createNode({ responses: [firstError, secondError, success] });

    await scheduler.runNext();
    assert.equal(node.errors.length, 1);
    assert.equal(scheduler.tasks[0].delay, 5000);

    await scheduler.runNext();
    assert.equal(node.errors.length, 1);
    assert.equal(scheduler.tasks[0].delay, 10000);

    await scheduler.runNext();
    assert.equal(node.sent.length, 1);
    assert.deepEqual(node.statuses.at(-1), { fill: 'green', shape: 'dot', text: 'connected' });
});

test('closing the node cancels a scheduled poll', () => {
    const { node, scheduler } = createNode({ responses: [] });
    let closed = false;

    node.emit('close', false, () => { closed = true; });

    assert.equal(closed, true);
    assert.equal(scheduler.tasks[0].cancelled, true);
    assert.deepEqual(node.statuses.at(-1), {});
});

test('closing the node aborts an in-flight request', async () => {
    const scheduler = createScheduler();
    let receivedSignal;
    const fakeClient = {
        getDashboard({ signal }) {
            receivedSignal = signal;
            return new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => {
                    const error = new Error('aborted');
                    error.name = 'AbortError';
                    reject(error);
                });
            });
        }
    };
    const red = createRed();
    _internals.createRegistration({
        clientFactory: () => fakeClient,
        setTimeoutFn: scheduler.setTimeoutFn,
        clearTimeoutFn: scheduler.clearTimeoutFn
    })(red.RED);
    const NodeConstructor = red.getConstructor();
    const node = new NodeConstructor({
        authType: 'token',
        interval: 5,
        _credentials: { token: 'session' }
    });

    const pollTask = scheduler.tasks.shift();
    const pollPromise = pollTask.fn();
    await Promise.resolve();
    node.emit('close', false, () => {});
    await pollPromise;

    assert.equal(receivedSignal.aborted, true);
    assert.equal(node.errors.length, 0);
});
