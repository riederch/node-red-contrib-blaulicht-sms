'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const {
    BlaulichtSmsDashboardClient,
    DASHBOARD_API_PATH,
    requestJson
} = require('../lib/blaulicht-sms-client');

function createRequestQueue(items, captured = []) {
    return (url, options, callback) => {
        const item = items.shift();
        const request = new EventEmitter();
        let payload = '';

        request.setTimeout = () => {};
        request.write = (chunk) => { payload += chunk; };
        request.destroy = (error) => process.nextTick(() => request.emit('error', error));
        request.end = () => {
            captured.push({ url: url.toString(), options, payload });
            process.nextTick(() => {
                if (item.error) {
                    request.emit('error', item.error);
                    return;
                }

                const response = new EventEmitter();
                response.statusCode = item.statusCode;
                response.headers = item.headers || { 'content-type': 'application/json' };
                response.setEncoding = () => {};
                callback(response);
                if (item.body !== undefined) {
                    response.emit('data', typeof item.body === 'string' ? item.body : JSON.stringify(item.body));
                }
                response.emit('end');
            });
        };
        return request;
    };
}

test('requestJson sends JSON to the documented API path', async () => {
    const captured = [];
    const requestImpl = createRequestQueue([
        { statusCode: 200, body: { success: true, sessionId: 'session-1' } }
    ], captured);

    const result = await requestJson({
        method: 'POST',
        path: `${DASHBOARD_API_PATH}/login`,
        body: { username: 'dashboard', password: 'secret', customerId: '123456' },
        requestImpl
    });

    assert.equal(result.data.sessionId, 'session-1');
    assert.equal(captured[0].url, 'https://api.blaulichtsms.net/blaulicht/api/alarm/v1/dashboard/login');
    assert.equal(captured[0].options.method, 'POST');
    assert.equal(captured[0].options.headers.Accept, 'application/json');
    assert.deepEqual(JSON.parse(captured[0].payload), {
        username: 'dashboard',
        password: 'secret',
        customerId: '123456'
    });
});

test('requestJson reports malformed JSON without crashing the runtime', async () => {
    const requestImpl = createRequestQueue([
        { statusCode: 200, body: 'not-json' }
    ]);

    await assert.rejects(
        requestJson({ method: 'GET', path: '/test', requestImpl }),
        (error) => error.code === 'INVALID_JSON' && error.statusCode === 200
    );
});

test('requestJson limits response size', async () => {
    const requestImpl = createRequestQueue([
        { statusCode: 200, body: '{"payload":"too large"}' }
    ]);

    await assert.rejects(
        requestJson({ method: 'GET', path: '/test', requestImpl, maxResponseBytes: 5 }),
        (error) => error.code === 'RESPONSE_TOO_LARGE'
    );
});

test('credential authentication logs in and retrieves dashboard data', async () => {
    const captured = [];
    const requestImpl = createRequestQueue([
        { statusCode: 200, body: { success: true, sessionId: 'session-1', error: null } },
        { statusCode: 200, body: { customerId: '123456', alarms: [], infos: [], integrations: [] } }
    ], captured);
    const client = new BlaulichtSmsDashboardClient({
        authType: 'credentials',
        customerId: '123456',
        username: 'dashboard',
        password: 'secret',
        requestImpl
    });

    const data = await client.getDashboard();

    assert.equal(data.customerId, '123456');
    assert.equal(captured.length, 2);
    assert.match(captured[1].url, /\/dashboard\/session-1$/);
});

test('credential authentication renews an expired session once', async () => {
    const captured = [];
    const requestImpl = createRequestQueue([
        { statusCode: 200, body: { success: true, sessionId: 'expired', error: null } },
        { statusCode: 401, body: { error: 'UNAUTHORIZED' } },
        { statusCode: 200, body: { success: true, sessionId: 'renewed', error: null } },
        { statusCode: 200, body: { customerId: '123456', alarms: [{ alarmId: 'a1' }], infos: [] } }
    ], captured);
    const client = new BlaulichtSmsDashboardClient({
        authType: 'credentials',
        customerId: '123456',
        username: 'dashboard',
        password: 'secret',
        requestImpl
    });

    const data = await client.getDashboard();

    assert.equal(data.alarms[0].alarmId, 'a1');
    assert.equal(captured.length, 4);
    assert.match(captured[3].url, /\/dashboard\/renewed$/);
});

test('a rejected manually supplied token is reported explicitly', async () => {
    const requestImpl = createRequestQueue([
        { statusCode: 401, body: { error: 'UNAUTHORIZED' } }
    ]);
    const client = new BlaulichtSmsDashboardClient({
        authType: 'token',
        token: 'invalid-token',
        requestImpl
    });

    await assert.rejects(
        client.getDashboard(),
        (error) => error.code === 'TOKEN_REJECTED' && error.statusCode === 401
    );
});
