'use strict';

const https = require('node:https');

const DEFAULT_BASE_URL = 'https://api.blaulichtsms.net/blaulicht';
const DASHBOARD_API_PATH = '/api/alarm/v1/dashboard';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

class BlaulichtSmsError extends Error {
    constructor(message, options = {}) {
        super(message, options.cause ? { cause: options.cause } : undefined);
        this.name = 'BlaulichtSmsError';
        this.code = options.code || 'BLAULICHTSMS_ERROR';
        this.statusCode = options.statusCode;
        this.apiError = options.apiError;
        this.retryable = Boolean(options.retryable);
    }
}

function normalizeBaseUrl(value) {
    const url = new URL(value || DEFAULT_BASE_URL);
    if (url.protocol !== 'https:') {
        throw new BlaulichtSmsError('The blaulichtSMS API URL must use HTTPS', {
            code: 'CONFIGURATION_ERROR'
        });
    }
    url.pathname = url.pathname.replace(/\/$/, '');
    return url;
}

function buildUrl(baseUrl, path) {
    const url = new URL(baseUrl.toString());
    const suffix = String(path || '').startsWith('/') ? String(path) : `/${path}`;
    url.pathname = `${url.pathname}${suffix}`.replace(/\/{2,}/g, '/');
    return url;
}

function isRetryableStatus(statusCode) {
    return statusCode === 429 || statusCode >= 500;
}

function requestJson({
    method,
    path,
    body,
    baseUrl = DEFAULT_BASE_URL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
    signal,
    requestImpl = https.request,
    userAgent = 'node-red-contrib-blaulicht-sms'
}) {
    return new Promise((resolve, reject) => {
        const target = buildUrl(normalizeBaseUrl(baseUrl), path);
        const payload = body === undefined ? null : JSON.stringify(body);
        const headers = {
            Accept: 'application/json',
            'User-Agent': userAgent
        };

        if (payload !== null) {
            headers['Content-Type'] = 'application/json; charset=utf-8';
            headers['Content-Length'] = Buffer.byteLength(payload);
        }

        let settled = false;
        const finish = (callback, value) => {
            if (settled) {
                return;
            }
            settled = true;
            callback(value);
        };

        const request = requestImpl(target, {
            method,
            headers,
            signal
        }, (response) => {
            const chunks = [];
            let receivedBytes = 0;
            response.setEncoding('utf8');

            response.on('data', (chunk) => {
                receivedBytes += Buffer.byteLength(chunk);
                if (receivedBytes > maxResponseBytes) {
                    const error = new BlaulichtSmsError(
                        `blaulichtSMS response exceeded ${maxResponseBytes} bytes`,
                        { code: 'RESPONSE_TOO_LARGE', statusCode: response.statusCode }
                    );
                    request.destroy(error);
                    finish(reject, error);
                    return;
                }
                chunks.push(chunk);
            });

            response.on('end', () => {
                if (settled) {
                    return;
                }

                const rawBody = chunks.join('');
                let data = null;
                if (rawBody.length > 0) {
                    try {
                        data = JSON.parse(rawBody);
                    } catch (cause) {
                        finish(reject, new BlaulichtSmsError(
                            `blaulichtSMS returned invalid JSON (HTTP ${response.statusCode})`,
                            {
                                code: 'INVALID_JSON',
                                statusCode: response.statusCode,
                                cause
                            }
                        ));
                        return;
                    }
                }

                finish(resolve, {
                    statusCode: response.statusCode,
                    headers: response.headers || {},
                    data
                });
            });

            response.on('error', (cause) => {
                finish(reject, new BlaulichtSmsError('Failed to read the blaulichtSMS response', {
                    code: cause.code || 'RESPONSE_ERROR',
                    statusCode: response.statusCode,
                    retryable: true,
                    cause
                }));
            });
        });

        request.setTimeout(timeoutMs, () => {
            request.destroy(new BlaulichtSmsError(
                `blaulichtSMS request timed out after ${timeoutMs} ms`,
                { code: 'ETIMEDOUT', retryable: true }
            ));
        });

        request.on('error', (cause) => {
            if (cause instanceof BlaulichtSmsError) {
                finish(reject, cause);
                return;
            }
            finish(reject, new BlaulichtSmsError('Unable to reach blaulichtSMS', {
                code: cause.code || 'NETWORK_ERROR',
                retryable: true,
                cause
            }));
        });

        if (payload !== null) {
            request.write(payload);
        }
        request.end();
    });
}

function assertDashboardResponse(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new BlaulichtSmsError('blaulichtSMS returned an invalid dashboard response', {
            code: 'INVALID_RESPONSE'
        });
    }
    return data;
}

class BlaulichtSmsDashboardClient {
    constructor(options = {}) {
        this.authType = options.authType === 'token' ? 'token' : 'credentials';
        this.token = String(options.token || '').trim();
        this.customerId = String(options.customerId || '').trim();
        this.username = String(options.username || '').trim();
        this.password = String(options.password || '');
        this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
        this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
        this.maxResponseBytes = options.maxResponseBytes || DEFAULT_MAX_RESPONSE_BYTES;
        this.userAgent = options.userAgent || 'node-red-contrib-blaulicht-sms';
        this.requestImpl = options.requestImpl || https.request;
        this.sessionId = this.authType === 'token' ? this.token : null;
    }

    validateConfiguration() {
        if (this.authType === 'token') {
            if (!this.token) {
                throw new BlaulichtSmsError('A Dashboard API session token is required', {
                    code: 'CONFIGURATION_ERROR'
                });
            }
            return;
        }

        if (!this.customerId || !this.username || !this.password) {
            throw new BlaulichtSmsError('Customer ID, username and password are required', {
                code: 'CONFIGURATION_ERROR'
            });
        }
    }

    async request(options) {
        return requestJson({
            ...options,
            baseUrl: this.baseUrl,
            timeoutMs: this.timeoutMs,
            maxResponseBytes: this.maxResponseBytes,
            requestImpl: this.requestImpl,
            userAgent: this.userAgent
        });
    }

    async login({ signal } = {}) {
        this.validateConfiguration();
        if (this.authType === 'token') {
            this.sessionId = this.token;
            return this.sessionId;
        }

        const response = await this.request({
            method: 'POST',
            path: `${DASHBOARD_API_PATH}/login`,
            body: {
                username: this.username,
                password: this.password,
                customerId: this.customerId
            },
            signal
        });

        const apiError = response.data && response.data.error;
        if (
            response.statusCode !== 200 ||
            !response.data ||
            response.data.success !== true ||
            !response.data.sessionId
        ) {
            throw new BlaulichtSmsError(apiError || `Dashboard login failed with HTTP ${response.statusCode}`, {
                code: 'LOGIN_FAILED',
                statusCode: response.statusCode,
                apiError,
                retryable: isRetryableStatus(response.statusCode)
            });
        }

        this.sessionId = response.data.sessionId;
        return this.sessionId;
    }

    async getDashboard({ signal } = {}) {
        this.validateConfiguration();
        if (!this.sessionId) {
            await this.login({ signal });
        }

        let response = await this.request({
            method: 'GET',
            path: `${DASHBOARD_API_PATH}/${encodeURIComponent(this.sessionId)}`,
            signal
        });

        if (response.statusCode === 401 && this.authType === 'credentials') {
            this.sessionId = null;
            await this.login({ signal });
            response = await this.request({
                method: 'GET',
                path: `${DASHBOARD_API_PATH}/${encodeURIComponent(this.sessionId)}`,
                signal
            });
        }

        if (response.statusCode !== 200) {
            const tokenRejected = response.statusCode === 401 && this.authType === 'token';
            throw new BlaulichtSmsError(
                tokenRejected ? 'The Dashboard API session token was rejected' : `Dashboard request failed with HTTP ${response.statusCode}`,
                {
                    code: tokenRejected ? 'TOKEN_REJECTED' : 'DASHBOARD_REQUEST_FAILED',
                    statusCode: response.statusCode,
                    retryable: isRetryableStatus(response.statusCode)
                }
            );
        }

        return assertDashboardResponse(response.data);
    }
}

module.exports = {
    BlaulichtSmsDashboardClient,
    BlaulichtSmsError,
    DASHBOARD_API_PATH,
    DEFAULT_BASE_URL,
    DEFAULT_MAX_RESPONSE_BYTES,
    DEFAULT_TIMEOUT_MS,
    assertDashboardResponse,
    buildUrl,
    isRetryableStatus,
    normalizeBaseUrl,
    requestJson
};
