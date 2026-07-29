'use strict';

const { BlaulichtSmsAlarmClient, STAGING_BASE_URL } = require('./lib/blaulicht-sms-alarm-client');
const { DEFAULT_BASE_URL } = require('./lib/blaulicht-sms-client');

const OPERATIONS = new Set(['trigger', 'query', 'list']);
const AMBIGUOUS_TRIGGER_ERROR_CODES = new Set([
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNABORTED',
    'EPIPE',
    'NETWORK_ERROR',
    'EAI_AGAIN'
]);

function normalizeOperation(value) {
    const operation = String(value || 'trigger').trim().toLowerCase();
    if (!OPERATIONS.has(operation)) {
        const error = new Error(`Unsupported Alarm API operation: ${operation}`);
        error.code = 'UNSUPPORTED_OPERATION';
        throw error;
    }
    return operation;
}

function isEnabled(value) {
    return value === true || value === 'true';
}

function assertLiveTriggerAllowed(operation, environment, liveTriggerEnabled) {
    if (operation === 'trigger' && environment === 'live' && !liveTriggerEnabled) {
        const error = new Error(
            'Live alarm triggering is disabled. Enable the explicit live-trigger confirmation in the node configuration.'
        );
        error.code = 'LIVE_TRIGGER_NOT_ENABLED';
        throw error;
    }
}

function normalizeOperationError(error, operation) {
    if (
        operation === 'trigger' &&
        error &&
        (error.retryable || AMBIGUOUS_TRIGGER_ERROR_CODES.has(error.code))
    ) {
        const uncertain = new Error(
            'The trigger request did not complete reliably. The alarm may already have been accepted; verify it with query or list before sending another trigger.'
        );
        uncertain.name = 'BlaulichtSmsTriggerOutcomeUnknownError';
        uncertain.code = 'TRIGGER_OUTCOME_UNKNOWN';
        uncertain.apiError = error.apiError;
        uncertain.statusCode = error.statusCode;
        uncertain.cause = error;
        return uncertain;
    }
    return error;
}

function resolveInput(msg, config) {
    if (msg && msg.payload !== undefined) {
        return msg.payload;
    }

    if (config.operation === 'trigger') {
        return {
            customerId: config.customerId,
            type: config.eventType,
            alarmText: config.alarmText,
            needsAcknowledgement: Boolean(config.needsAcknowledgement),
            duration: config.duration === '' ? undefined : Number(config.duration),
            groupCodes: String(config.groupCodes || '').split(',').map((value) => value.trim()).filter(Boolean),
            template: config.template || undefined
        };
    }

    return {};
}

function createRegistration(dependencies = {}) {
    const clientFactory = dependencies.clientFactory || ((options) => new BlaulichtSmsAlarmClient(options));
    const now = dependencies.now || (() => new Date());

    return function registerNode(RED) {
        function BlaulichtSmsAlarmNode(config) {
            RED.nodes.createNode(this, config);
            const node = this;
            const credentials = node.credentials || {};
            const operation = normalizeOperation(config.operation);
            const environment = config.environment === 'live' ? 'live' : 'staging';
            const liveTriggerEnabled = isEnabled(config.liveTriggerEnabled);
            const client = clientFactory({
                customerId: config.customerId,
                username: credentials.username,
                password: credentials.password,
                baseUrl: environment === 'live' ? DEFAULT_BASE_URL : STAGING_BASE_URL
            });

            let requestInProgress = false;
            let abortController = null;

            node.status({ fill: 'grey', shape: 'ring', text: 'ready' });

            node.on('input', async (msg, send, done) => {
                const output = typeof send === 'function' ? send : node.send.bind(node);
                const hasDone = typeof done === 'function';
                const complete = hasDone ? done : () => {};
                const fail = (error) => {
                    if (hasDone) {
                        complete(error);
                    } else {
                        node.error(error.message, msg);
                    }
                };

                if (requestInProgress) {
                    const error = new Error('An Alarm API request is already in progress');
                    error.code = 'REQUEST_IN_PROGRESS';
                    node.status({ fill: 'yellow', shape: 'ring', text: 'busy' });
                    fail(error);
                    return;
                }

                requestInProgress = true;
                abortController = new AbortController();
                node.status({ fill: 'yellow', shape: 'dot', text: operation });

                try {
                    assertLiveTriggerAllowed(operation, environment, liveTriggerEnabled);
                    const input = resolveInput(msg, { ...config, operation });
                    let result;
                    if (operation === 'trigger') {
                        result = await client.triggerAlarm(input, { signal: abortController.signal });
                    } else if (operation === 'query') {
                        result = await client.queryAlarm(input, { signal: abortController.signal });
                    } else {
                        result = await client.listAlarms(input, { signal: abortController.signal });
                    }

                    output({
                        ...msg,
                        topic: `blaulichtsms/alarm/${operation}`,
                        payload: result,
                        blaulichtSms: {
                            operation,
                            environment,
                            receivedAt: now().toISOString()
                        }
                    });
                    node.status({ fill: 'green', shape: 'dot', text: 'success' });
                    complete();
                } catch (cause) {
                    if (cause && cause.name === 'AbortError') {
                        complete();
                    } else {
                        const error = normalizeOperationError(cause, operation);
                        node.status({ fill: 'red', shape: 'ring', text: error.apiError || error.code || 'error' });
                        fail(error);
                    }
                } finally {
                    requestInProgress = false;
                    abortController = null;
                }
            });

            node.on('close', (_removed, done) => {
                if (abortController) {
                    abortController.abort();
                }
                node.status({});
                if (typeof done === 'function') {
                    done();
                }
            });
        }

        RED.nodes.registerType('bl-sms-alarm', BlaulichtSmsAlarmNode, {
            credentials: {
                username: { type: 'text' },
                password: { type: 'password' }
            }
        });
    };
}

module.exports = createRegistration();
module.exports._internals = {
    AMBIGUOUS_TRIGGER_ERROR_CODES,
    OPERATIONS,
    assertLiveTriggerAllowed,
    createRegistration,
    isEnabled,
    normalizeOperation,
    normalizeOperationError,
    resolveInput
};
