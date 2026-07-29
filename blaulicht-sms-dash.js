'use strict';

const { isDeepStrictEqual } = require('node:util');
const { version: packageVersion } = require('./package.json');
const {
    BlaulichtSmsDashboardClient,
    BlaulichtSmsError
} = require('./lib/blaulicht-sms-client');

const MIN_INTERVAL_SECONDS = 5;
const MAX_INTERVAL_SECONDS = 86400;
const DEFAULT_INTERVAL_SECONDS = 10;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

function parseIntervalSeconds(value) {
    const interval = Number(value);
    if (!Number.isInteger(interval) || interval < MIN_INTERVAL_SECONDS || interval > MAX_INTERVAL_SECONDS) {
        return DEFAULT_INTERVAL_SECONDS;
    }
    return interval;
}

function inferAuthType(config, credentials) {
    if (config.authType === 'token' || config.authType === 'credentials') {
        return config.authType;
    }

    const hasToken = Boolean(credentials.token || config.token);
    const hasCredentials = Boolean(
        credentials.username ||
        credentials.password ||
        config.user ||
        config.password ||
        config.customerId ||
        config.kid
    );
    return hasToken && !hasCredentials ? 'token' : 'credentials';
}

function resolveConfiguration(config, credentials = {}) {
    const authType = inferAuthType(config, credentials);
    return {
        authType,
        token: credentials.token || config.token || '',
        username: credentials.username || config.user || '',
        password: credentials.password || config.password || '',
        customerId: String(config.customerId || config.kid || '').trim(),
        intervalSeconds: parseIntervalSeconds(config.interval || config.timer),
        updateOnly: config.updateOnly === true || config.updateOnly === 'true'
    };
}

function calculateRetryDelay(intervalMs, consecutiveFailures) {
    const exponent = Math.max(0, Math.min(consecutiveFailures - 1, 6));
    return Math.min(intervalMs * (2 ** exponent), MAX_RETRY_DELAY_MS);
}

function errorPresentation(error) {
    const code = error && error.code;
    switch (code) {
        case 'CONFIGURATION_ERROR':
            return { status: 'configuration error', log: 'configuration error' };
        case 'LOGIN_FAILED':
            return { status: 'login failed', log: 'login failed' };
        case 'TOKEN_REJECTED':
            return { status: 'token rejected', log: 'token rejected' };
        case 'INVALID_JSON':
        case 'INVALID_RESPONSE':
        case 'RESPONSE_TOO_LARGE':
            return { status: 'invalid response', log: 'invalid API response' };
        default:
            return { status: 'connection error', log: 'connection error' };
    }
}

function createRegistration(dependencies = {}) {
    const clientFactory = dependencies.clientFactory || ((options) => new BlaulichtSmsDashboardClient(options));
    const setTimeoutFn = dependencies.setTimeoutFn || setTimeout;
    const clearTimeoutFn = dependencies.clearTimeoutFn || clearTimeout;
    const now = dependencies.now || (() => new Date());

    return function registerNode(RED) {
        function BlaulichtSmsDashboardNode(config) {
            RED.nodes.createNode(this, config);
            const node = this;
            const resolved = resolveConfiguration(config, node.credentials || {});
            const intervalMs = resolved.intervalSeconds * 1000;
            const client = clientFactory({
                authType: resolved.authType,
                token: resolved.token,
                username: resolved.username,
                password: resolved.password,
                customerId: resolved.customerId,
                userAgent: `node-red-contrib-blaulicht-sms/${packageVersion}`
            });

            let timer = null;
            let abortController = null;
            let stopped = false;
            let previousData;
            let consecutiveFailures = 0;
            let lastLoggedError = null;

            function setStatus(fill, shape, text) {
                node.status({ fill, shape, text });
            }

            function schedule(delayMs) {
                if (stopped) {
                    return;
                }
                timer = setTimeoutFn(runPoll, delayMs);
            }

            function reportError(error) {
                const presentation = errorPresentation(error);
                setStatus('red', 'ring', presentation.status);
                const details = error && error.message ? error.message : String(error);
                const signature = `${error && error.code}|${error && error.statusCode}|${details}`;
                if (signature !== lastLoggedError) {
                    node.error(`${presentation.log}: ${details}`);
                    lastLoggedError = signature;
                }
            }

            async function runPoll() {
                if (stopped) {
                    return;
                }

                timer = null;
                abortController = new AbortController();
                setStatus('yellow', 'ring', 'requesting');

                try {
                    const data = await client.getDashboard({ signal: abortController.signal });
                    if (stopped) {
                        return;
                    }

                    const changed = previousData === undefined || !isDeepStrictEqual(data, previousData);
                    setStatus('green', 'dot', 'connected');
                    if (!resolved.updateOnly || changed) {
                        node.send({
                            topic: 'blaulichtsms/dashboard',
                            payload: data,
                            blaulichtSms: {
                                receivedAt: now().toISOString(),
                                changed
                            }
                        });
                    }

                    previousData = data;
                    consecutiveFailures = 0;
                    lastLoggedError = null;
                    schedule(intervalMs);
                } catch (error) {
                    if (stopped && (error.name === 'AbortError' || error.code === 'ABORT_ERR')) {
                        return;
                    }

                    consecutiveFailures += 1;
                    reportError(error);
                    schedule(calculateRetryDelay(intervalMs, consecutiveFailures));
                } finally {
                    abortController = null;
                }
            }

            setStatus('grey', 'ring', 'starting');
            schedule(0);

            node.on('close', (removed, done) => {
                if (typeof removed === 'function') {
                    done = removed;
                }
                stopped = true;
                if (timer !== null) {
                    clearTimeoutFn(timer);
                    timer = null;
                }
                if (abortController) {
                    abortController.abort();
                    abortController = null;
                }
                node.status({});
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
}

const registerNode = createRegistration();

module.exports = registerNode;
module.exports._internals = {
    BlaulichtSmsError,
    DEFAULT_INTERVAL_SECONDS,
    MAX_INTERVAL_SECONDS,
    MAX_RETRY_DELAY_MS,
    MIN_INTERVAL_SECONDS,
    calculateRetryDelay,
    createRegistration,
    errorPresentation,
    inferAuthType,
    parseIntervalSeconds,
    resolveConfiguration
};
