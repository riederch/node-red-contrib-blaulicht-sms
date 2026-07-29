'use strict';

const https = require('node:https');
const {
    BlaulichtSmsError,
    DEFAULT_BASE_URL,
    DEFAULT_MAX_RESPONSE_BYTES,
    DEFAULT_TIMEOUT_MS,
    isRetryableStatus,
    requestJson
} = require('./blaulicht-sms-client');

const STAGING_BASE_URL = 'https://api-staging.blaulichtsms.net/blaulicht';
const ALARM_API_PATH = '/api/alarm/v1';
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

function requireNonEmptyString(value, fieldName) {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
        throw new BlaulichtSmsError(`${fieldName} is required`, {
            code: 'VALIDATION_ERROR'
        });
    }
    return normalized;
}

function optionalString(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    const normalized = String(value).trim();
    return normalized || undefined;
}

function requireBoolean(value, fieldName) {
    if (typeof value !== 'boolean') {
        throw new BlaulichtSmsError(`${fieldName} must be a boolean`, {
            code: 'VALIDATION_ERROR'
        });
    }
    return value;
}

function optionalBoolean(value, fieldName) {
    if (value === undefined || value === null) {
        return undefined;
    }
    return requireBoolean(value, fieldName);
}

function optionalInteger(value, fieldName, { minimum } = {}) {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    const normalized = Number(value);
    if (!Number.isInteger(normalized) || (minimum !== undefined && normalized < minimum)) {
        const suffix = minimum === undefined ? '' : ` greater than or equal to ${minimum}`;
        throw new BlaulichtSmsError(`${fieldName} must be an integer${suffix}`, {
            code: 'VALIDATION_ERROR'
        });
    }
    return normalized;
}

function optionalIsoDate(value, fieldName) {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new BlaulichtSmsError(`${fieldName} must be a valid ISO date`, {
            code: 'VALIDATION_ERROR'
        });
    }
    return date.toISOString();
}

function normalizeStringArray(value, fieldName, { validator } = {}) {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }

    const input = Array.isArray(value) ? value : String(value).split(',');
    const normalized = input.map((entry) => String(entry).trim()).filter(Boolean);
    if (normalized.length === 0) {
        return [];
    }
    if (validator) {
        for (const entry of normalized) {
            if (!validator(entry)) {
                throw new BlaulichtSmsError(`${fieldName} contains an invalid value: ${entry}`, {
                    code: 'VALIDATION_ERROR'
                });
            }
        }
    }
    return [...new Set(normalized)];
}

function normalizeCoordinates(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new BlaulichtSmsError('coordinates must be an object', {
            code: 'VALIDATION_ERROR'
        });
    }
    const lat = Number(value.lat);
    const lon = Number(value.lon);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        throw new BlaulichtSmsError('coordinates.lat must be between -90 and 90', {
            code: 'VALIDATION_ERROR'
        });
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
        throw new BlaulichtSmsError('coordinates.lon must be between -180 and 180', {
            code: 'VALIDATION_ERROR'
        });
    }
    return { lat, lon };
}

function normalizeGeolocation(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new BlaulichtSmsError('geolocation must be an object', {
            code: 'VALIDATION_ERROR'
        });
    }
    return { address: requireNonEmptyString(value.address, 'geolocation.address') };
}

function compactObject(value) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function normalizeTriggerPayload(input, defaultCustomerId) {
    const payload = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const customerId = requireNonEmptyString(payload.customerId || defaultCustomerId, 'customerId');
    const type = requireNonEmptyString(payload.type, 'type').toLowerCase();
    if (type !== 'alarm' && type !== 'info') {
        throw new BlaulichtSmsError('type must be either alarm or info', {
            code: 'VALIDATION_ERROR'
        });
    }

    const needsAcknowledgement = requireBoolean(payload.needsAcknowledgement, 'needsAcknowledgement');
    const duration = optionalInteger(payload.duration, 'duration', { minimum: 1 });
    if (needsAcknowledgement && duration === undefined) {
        throw new BlaulichtSmsError('duration is required when needsAcknowledgement is true', {
            code: 'VALIDATION_ERROR'
        });
    }

    const coordinates = normalizeCoordinates(payload.coordinates);
    const geolocation = normalizeGeolocation(payload.geolocation);
    if (coordinates && geolocation) {
        throw new BlaulichtSmsError('Use either coordinates or geolocation, not both', {
            code: 'VALIDATION_ERROR'
        });
    }

    const recipientConfirmation = optionalBoolean(payload.recipientConfirmation, 'recipientConfirmation');
    const recipientConfirmationTarget = optionalString(payload.recipientConfirmationTarget);
    if (recipientConfirmationTarget && !E164_PATTERN.test(recipientConfirmationTarget)) {
        throw new BlaulichtSmsError('recipientConfirmationTarget must use international E.164 format', {
            code: 'VALIDATION_ERROR'
        });
    }

    return compactObject({
        customerId,
        type,
        hideTriggerDetails: optionalBoolean(payload.hideTriggerDetails, 'hideTriggerDetails'),
        alarmText: optionalString(payload.alarmText),
        indexNumber: optionalInteger(payload.indexNumber, 'indexNumber'),
        needsAcknowledgement,
        startDate: optionalIsoDate(payload.startDate, 'startDate'),
        duration: needsAcknowledgement ? duration : undefined,
        recipientConfirmation,
        recipientConfirmationTarget,
        template: optionalString(payload.template),
        groupCodes: normalizeStringArray(payload.groupCodes, 'groupCodes'),
        additionalMsisdns: normalizeStringArray(payload.additionalMsisdns, 'additionalMsisdns', {
            validator: (entry) => E164_PATTERN.test(entry)
        }),
        coordinates,
        geolocation
    });
}

function normalizeQueryPayload(input, defaultCustomerId) {
    const payload = input && typeof input === 'object' && !Array.isArray(input)
        ? input
        : { alarmId: input };
    return {
        customerId: requireNonEmptyString(payload.customerId || defaultCustomerId, 'customerId'),
        alarmId: requireNonEmptyString(payload.alarmId, 'alarmId')
    };
}

function normalizeListPayload(input, defaultCustomerId) {
    const payload = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const customerIds = normalizeStringArray(payload.customerIds, 'customerIds') ||
        (defaultCustomerId ? [String(defaultCustomerId).trim()] : []);
    if (customerIds.length === 0) {
        throw new BlaulichtSmsError('customerIds is required', {
            code: 'VALIDATION_ERROR'
        });
    }

    const startDate = optionalIsoDate(payload.startDate, 'startDate');
    const endDate = optionalIsoDate(payload.endDate, 'endDate');
    if (startDate && endDate && Date.parse(startDate) > Date.parse(endDate)) {
        throw new BlaulichtSmsError('startDate must not be after endDate', {
            code: 'VALIDATION_ERROR'
        });
    }

    return compactObject({ customerIds, startDate, endDate });
}

function assertAlarmApiResult(response, operation) {
    const result = response.data && response.data.result;
    if (response.statusCode !== 200 || result !== 'OK') {
        const description = response.data && response.data.description;
        const apiError = result || `HTTP_${response.statusCode}`;
        throw new BlaulichtSmsError(
            description || `blaulichtSMS Alarm API ${operation} failed with ${apiError}`,
            {
                code: 'ALARM_API_REQUEST_FAILED',
                statusCode: response.statusCode,
                apiError,
                retryable: isRetryableStatus(response.statusCode)
            }
        );
    }
    return response.data;
}

class BlaulichtSmsAlarmClient {
    constructor(options = {}) {
        this.customerId = String(options.customerId || '').trim();
        this.username = String(options.username || '').trim();
        this.password = String(options.password || '');
        this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
        this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
        this.maxResponseBytes = options.maxResponseBytes || DEFAULT_MAX_RESPONSE_BYTES;
        this.userAgent = options.userAgent || 'node-red-contrib-blaulicht-sms';
        this.requestImpl = options.requestImpl || https.request;
    }

    validateConfiguration() {
        requireNonEmptyString(this.username, 'username');
        requireNonEmptyString(this.password, 'password');
    }

    async request(operation, body, { signal } = {}) {
        this.validateConfiguration();
        const response = await requestJson({
            method: 'POST',
            path: `${ALARM_API_PATH}/${operation}`,
            body: {
                username: this.username,
                password: this.password,
                ...body
            },
            baseUrl: this.baseUrl,
            timeoutMs: this.timeoutMs,
            maxResponseBytes: this.maxResponseBytes,
            requestImpl: this.requestImpl,
            userAgent: this.userAgent,
            signal
        });
        return assertAlarmApiResult(response, operation);
    }

    async triggerAlarm(input, options = {}) {
        return this.request('trigger', normalizeTriggerPayload(input, this.customerId), options);
    }

    async queryAlarm(input, options = {}) {
        return this.request('query', normalizeQueryPayload(input, this.customerId), options);
    }

    async listAlarms(input = {}, options = {}) {
        return this.request('list', normalizeListPayload(input, this.customerId), options);
    }
}

module.exports = {
    ALARM_API_PATH,
    BlaulichtSmsAlarmClient,
    E164_PATTERN,
    STAGING_BASE_URL,
    assertAlarmApiResult,
    normalizeCoordinates,
    normalizeGeolocation,
    normalizeListPayload,
    normalizeQueryPayload,
    normalizeStringArray,
    normalizeTriggerPayload,
    optionalIsoDate
};
