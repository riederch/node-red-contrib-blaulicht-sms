'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const https = require('node:https');
const { _internals } = require('../blaulicht-sms-dash');

test('parseInterval accepts valid seconds', () => {
    assert.equal(_internals.parseInterval(5), 5000);
    assert.equal(_internals.parseInterval('12'), 12000);
});

test('parseInterval falls back for invalid values', () => {
    assert.equal(_internals.parseInterval(4), 10000);
    assert.equal(_internals.parseInterval('invalid'), 10000);
});

test('isEqual compares dashboard payloads', () => {
    assert.equal(_internals.isEqual({ alarms: [1] }, { alarms: [1] }), true);
    assert.equal(_internals.isEqual({ alarms: [1] }, { alarms: [2] }), false);
});

test('requestJson sends a JSON login request', async (t) => {
    const originalRequest = https.request;
    t.after(() => { https.request = originalRequest; });

    let capturedOptions;
    let capturedPayload = '';
    https.request = (options, callback) => {
        capturedOptions = options;
        const response = new EventEmitter();
        response.statusCode = 200;
        response.setEncoding = () => {};

        const request = new EventEmitter();
        request.setTimeout = () => {};
        request.write = (chunk) => { capturedPayload += chunk; };
        request.end = () => {
            callback(response);
            response.emit('data', '{"success":true,"sessionId":"abc"}');
            response.emit('end');
        };
        request.destroy = (error) => request.emit('error', error);
        return request;
    };

    const result = await _internals.requestJson({
        method: 'POST',
        path: `${_internals.API_BASE_PATH}/login`,
        body: { username: 'user', password: 'secret', customerId: '123' }
    });

    assert.equal(capturedOptions.hostname, 'api.blaulichtsms.net');
    assert.equal(capturedOptions.method, 'POST');
    assert.equal(JSON.parse(capturedPayload).customerId, '123');
    assert.equal(result.data.sessionId, 'abc');
});

test('requestJson rejects malformed JSON', async (t) => {
    const originalRequest = https.request;
    t.after(() => { https.request = originalRequest; });

    https.request = (_options, callback) => {
        const response = new EventEmitter();
        response.statusCode = 200;
        response.setEncoding = () => {};
        const request = new EventEmitter();
        request.setTimeout = () => {};
        request.end = () => {
            callback(response);
            response.emit('data', 'not-json');
            response.emit('end');
        };
        request.destroy = (error) => request.emit('error', error);
        return request;
    };

    await assert.rejects(
        _internals.requestJson({ method: 'GET', path: '/test' }),
        (error) => error.code === 'INVALID_JSON'
    );
});

test('requestJson propagates network errors', async (t) => {
    const originalRequest = https.request;
    t.after(() => { https.request = originalRequest; });

    https.request = () => {
        const request = new EventEmitter();
        request.setTimeout = () => {};
        request.end = () => process.nextTick(() => request.emit('error', new Error('getaddrinfo EAI_AGAIN')));
        request.destroy = (error) => request.emit('error', error);
        return request;
    };

    await assert.rejects(
        _internals.requestJson({ method: 'GET', path: '/test' }),
        /EAI_AGAIN/
    );
});
