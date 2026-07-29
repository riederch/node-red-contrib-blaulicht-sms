'use strict';

const https = require('node:https');

const API_HOST = 'api.blaulichtsms.net';
const API_BASE_PATH = '/blaulicht/api/alarm/v1/dashboard';
const MIN_INTERVAL_SECONDS = 5;
const DEFAULT_INTERVAL_SECONDS = 10;
const REQUEST_TIMEOUT_MS = 15000;

function requestJson({ method, path, body, timeout = REQUEST_TIMEOUT_MS }) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : JSON.stringify(body);
        const options = {
            hostname: API_HOST,
            port: 443,
            method,
            path,
            headers: { Accept: 'application/json' }
        };

        if (payload !== null) {
            options.headers['Content-Type'] = 'application/json; charset=utf-8';
            options.headers['Content-Length'] = Buffer.byteLength(payload);
        }

        const request = https.request(options, (response) => {
            const chunks = [];
            response.setEncoding('utf8');
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                const rawBody = chunks.join('');
                let data = null;

                if (rawBody.length > 0) {
                    try {
                        data = JSON.parse(rawBody);
                    } catch (error) {
                        const parseError = new Error(`BlaulichtSMS returned invalid JSON (HTTP ${response.statusCode})`);
                        parseError.code = 'INVALID_JSON';
                        parseError.statusCode = response.statusCode;
                        parseError.cause = error;
                        reject(parseError);
                        return;
                    }
                }

                resolve({ statusCode: response.statusCode, data });
            });
        });

        request.setTimeout(timeout, () => {
            const timeoutError = new Error(`BlaulichtSMS request timed out after ${timeout} ms`);
            timeoutError.code = 'ETIMEDOUT';
            request.destroy(timeoutError);
        });
        request.on('error', reject);

        if (payload !== null) {
            request.write(payload);
        }
        request.end();
    });
}

function parseInterval(value) {
    const interval = Number(value);
    if (!Number.isFinite(interval) || interval < MIN_INTERVAL_SECONDS) {
        return DEFAULT_INTERVAL_SECONDS * 1000;
    }
    return interval * 1000;
}

function isEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

module.exports = function registerNode(RED) {
    function BlaulichtSmsDashboardNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        const credentials = node.credentials || {};
        // Keep flows created with versions <= 0.2.0 working after upgrade.
        const token = credentials.token || config.token || '';
        const username = credentials.username || config.user || '';
        const password = credentials.password || config.password || '';
        const customerId = String(config.customerId || config.kid || '').trim();
        const updateOnly = Boolean(config.updateOnly);
        const intervalMs = parseInterval(config.interval || config.timer);

        let sessionId = token || null;
        let previousData;
        let timer = null;
        let closed = false;
        let requestInProgress = false;

        function setStatus(fill, shape, text) {
            node.status({ fill, shape, text });
        }

        function reportError(error, message) {
            const details = error && error.message ? error.message : String(error);
            setStatus('red', 'ring', message);
            node.error(`${message}: ${details}`);
        }

        async function login() {
            if (token) {
                sessionId = token;
                return true;
            }

            if (!username || !password || !customerId) {
                setStatus('red', 'ring', 'credentials missing');
                return false;
            }

            setStatus('yellow', 'ring', 'signing in');
            const response = await requestJson({
                method: 'POST',
                path: `${API_BASE_PATH}/login`,
                body: { username, password, customerId }
            });

            if (response.statusCode !== 200 || !response.data || response.data.success !== true || !response.data.sessionId) {
                const apiError = response.data && response.data.error ? response.data.error : `HTTP ${response.statusCode}`;
                const error = new Error(apiError);
                error.code = 'LOGIN_FAILED';
                throw error;
            }

            sessionId = response.data.sessionId;
            setStatus('green', 'dot', 'session active');
            return true;
        }

        async function fetchDashboard(retryAfterUnauthorized = true) {
            if (!sessionId && !(await login())) {
                return;
            }

            setStatus('green', 'ring', 'requesting');
            const response = await requestJson({
                method: 'GET',
                path: `${API_BASE_PATH}/${encodeURIComponent(sessionId)}`
            });

            if (response.statusCode === 401 && !token && retryAfterUnauthorized) {
                sessionId = null;
                if (await login()) {
                    await fetchDashboard(false);
                }
                return;
            }

            if (response.statusCode !== 200) {
                const error = new Error(`HTTP ${response.statusCode}`);
                error.code = 'DASHBOARD_REQUEST_FAILED';
                throw error;
            }

            const data = response.data;
            setStatus('green', 'dot', 'data received');

            if (!updateOnly || previousData === undefined || !isEqual(data, previousData)) {
                node.send({ payload: data });
            }
            previousData = data;
        }

        async function poll() {
            if (closed || requestInProgress) {
                return;
            }

            requestInProgress = true;
            try {
                await fetchDashboard();
            } catch (error) {
                if (!token && error && error.code === 'LOGIN_FAILED') {
                    sessionId = null;
                    reportError(error, 'login failed');
                } else if (token && error && error.code === 'DASHBOARD_REQUEST_FAILED') {
                    reportError(error, 'token rejected');
                } else {
                    reportError(error, 'connection error');
                }
            } finally {
                requestInProgress = false;
            }
        }

        setStatus('grey', 'ring', 'disconnected');
        void poll();
        timer = setInterval(() => void poll(), intervalMs);

        node.on('close', (done) => {
            closed = true;
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            if (typeof done === 'function') {
                done();
            }
        });
    }

    RED.nodes.registerType('bl-sms-dash', BlaulichtSmsDashboardNode, {
        credentials: {
            token: { type: 'password' },
            username: { type: 'text' },
            password: { type: 'password' }
        }
    });
};

module.exports._internals = {
    API_BASE_PATH,
    API_HOST,
    DEFAULT_INTERVAL_SECONDS,
    MIN_INTERVAL_SECONDS,
    REQUEST_TIMEOUT_MS,
    isEqual,
    parseInterval,
    requestJson
};
