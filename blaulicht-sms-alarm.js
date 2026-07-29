'use strict';

const { BlaulichtSmsAlarmClient, STAGING_BASE_URL } = require('./lib/blaulicht-sms-alarm-client');
const { DEFAULT_BASE_URL } = require('./lib/blaulicht-sms-client');

const OPERATIONS = new Set(['trigger', 'query', 'list']);

function normalizeOperation(value) {
    const operation = String(value || 'trigger').trim().toLowerCase();
    if (!OPERATIONS.has(operation)) {
        throw new Error(`Unsupported Alarm API operation: ${operation}`);
    }
    return operation;
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
            const environment = config.environment === 'staging' ? 'staging' : 'live';
            const client = clientFactory({
                customerId: config.customerId,
                username: credentials.username,
                password: credentials.password,
                baseUrl: environment === 'staging' ? STAGING_BASE_URL : DEFAULT_BASE_URL
            });

            let requestInProgress = false;
            let abortController = null;

            node.status({ fill: 'grey', shape: 'ring', text: 'ready' });

            node.on('input', async (msg, send, done) => {
                const output = typeof send === 'function' ? send : node.send.bind(node);
                const complete = typeof done === 'function' ? done : () => {};

                if (requestInProgress) {
                    const error = new Error('An Alarm API request is already in progress');
                    error.code = 'REQUEST_IN_PROGRESS';
                    node.status({ fill: 'yellow', shape: 'ring', text: 'busy' });
                    complete(error);
                    return;
                }

                requestInProgress = true;
                abortController = new AbortController();
                node.status({ fill: 'yellow', shape: 'dot', text: operation });

                try {
                    const input = resolveInput(msg, { ...config, operation });
                    let result;
                    if (operation === 'trigger') {
                        result = await client.triggerAlarm(input, { signal: abortController.signal });
                    } else if (operation === 'query') {
                        result = await client.queryAlarm(input, { signal: abortController.signal });
                    } else {
                        result = await client.listAlarms(input, { signal: abortController.signal });
                    }

                    const responseMessage = {
                        ...msg,
                        topic: `blaulichtsms/alarm/${operation}`,
                        payload: result,
                        blaulichtSms: {
                            operation,
                            environment,
                            receivedAt: now().toISOString()
                        }
                    };
                    output(responseMessage);
                    node.status({ fill: 'green', shape: 'dot', text: 'success' });
                    complete();
                } catch (error) {
                    if (error && error.name === 'AbortError') {
                        complete();
                    } else {
                        node.status({ fill: 'red', shape: 'ring', text: error.apiError || error.code || 'error' });
                        node.error(error.message, msg);
                        complete(error);
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
    OPERATIONS,
    createRegistration,
    normalizeOperation,
    resolveInput
};
