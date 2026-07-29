'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const {
    BlaulichtSmsAlarmClient,
    normalizeListPayload,
    normalizeTriggerPayload
} = require('../lib/blaulicht-sms-alarm-client');

function createRequestMock(responseBody, statusCode = 200) {
    const calls = [];
    const requestImpl = (url, options, callback) => {
        let payload = '';
        const request = new EventEmitter();
        request.setTimeout = () => {};
        request.write = (chunk) => { payload += chunk; };
        request.destroy = (error) => request.emit('error', error);
        request.end = () => {
            calls.push({ url: url.toString(), options, body: JSON.parse(payload) });
            const response = new EventEmitter();
            response.statusCode = statusCode;
            response.headers = {};
            response.setEncoding = () => {};
            callback(response);
            response.emit('data', JSON.stringify(responseBody));
            response.emit('end');
        };
        return request;
    };
    return { calls, requestImpl };
}

test('trigger validation requires acknowledgement duration', () => {
    assert.throws(
        () => normalizeTriggerPayload({ type: 'alarm', needsAcknowledgement: true }, '100027'),
        /duration is required/
    );
});

test('trigger validation normalizes supported fields', () => {
    const result = normalizeTriggerPayload({
        type: 'ALARM',
        alarmText: 'Test',
        needsAcknowledgement: false,
        groupCodes: 'G1, G2,G1',
        additionalMsisdns: ['+436641234567'],
        coordinates: { lat: 46.6, lon: 13.8 }
    }, '100027');

    assert.equal(result.type, 'alarm');
    assert.deepEqual(result.groupCodes, ['G1', 'G2']);
    assert.deepEqual(result.coordinates, { lat: 46.6, lon: 13.8 });
});

test('list validation rejects inverted date ranges', () => {
    assert.throws(() => normalizeListPayload({
        customerIds: ['100027'],
        startDate: '2026-02-01T00:00:00Z',
        endDate: '2026-01-01T00:00:00Z'
    }), /startDate must not be after endDate/);
});

test('Alarm API client sends trigger credentials and payload', async () => {
    const mock = createRequestMock({ result: 'OK', alarmId: 'alarm-1', customerId: 100027 });
    const client = new BlaulichtSmsAlarmClient({
        customerId: '100027',
        username: 'trigger',
        password: 'secret',
        requestImpl: mock.requestImpl
    });

    const result = await client.triggerAlarm({
        type: 'alarm',
        alarmText: 'Test',
        needsAcknowledgement: false
    });

    assert.equal(result.alarmId, 'alarm-1');
    assert.match(mock.calls[0].url, /\/api\/alarm\/v1\/trigger$/);
    assert.equal(mock.calls[0].body.username, 'trigger');
    assert.equal(mock.calls[0].body.customerId, '100027');
});

test('Alarm API result codes are exposed as structured errors', async () => {
    const mock = createRequestMock({ result: 'INVALID_GROUP', description: 'Unknown group' });
    const client = new BlaulichtSmsAlarmClient({
        customerId: '100027', username: 'trigger', password: 'secret', requestImpl: mock.requestImpl
    });

    await assert.rejects(
        client.triggerAlarm({ type: 'alarm', needsAcknowledgement: false, groupCodes: ['BAD'] }),
        (error) => error.code === 'ALARM_API_REQUEST_FAILED' && error.apiError === 'INVALID_GROUP'
    );
});
