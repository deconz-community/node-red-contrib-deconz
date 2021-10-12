const CommandParser = require("../src/runtime/CommandParser");
const Utils = require("../src/runtime/Utils");
const got = require('got');
const ConfigMigration = require("../src/migration/ConfigMigration");
const dotProp = require("dot-prop");

const NodeType = 'deconz-output';
module.exports = function (RED) {

    const defaultCommand = {
        type: 'deconz_state',
        domain: 'lights',
        arg: {
            on: {type: 'keep', value: ""},
            alert: {type: 'str', value: ""},
            effect: {type: 'str', value: ""},
            colorloopspeed: {type: 'num', value: ""},
            open: {type: 'keep', value: ""},
            stop: {type: 'keep', value: ""},
            lift: {type: 'num', value: ""},
            tilt: {type: 'num', value: ""},
            group: {type: 'num', value: ""},
            scene: {type: 'num', value: ""},
            target: {type: 'state', value: ""},
            command: {type: 'str', value: "on"},
            payload: {type: 'msg', value: "payload"},
            delay: {type: 'num', value: "2000"},
            transitiontime: {type: 'num', value: ""},
            retryonerror: {type: 'num', value: "0"},
            aftererror: {type: 'continue', value: ""},
            bri: {direction: 'set', type: 'num', value: ""},
            sat: {direction: 'set', type: 'num', value: ""},
            hue: {direction: 'set', type: 'num', value: ""},
            ct: {direction: 'set', type: 'num', value: ""},
            xy: {direction: 'set', type: 'json', value: "[]"}
        }
    };

    const defaultConfig = {
        name: "",
        statustext: "",
        statustext_type: 'auto',
        search_type: 'device',
        device_list: [],
        device_name: '',
        query: '{}',
        commands: [defaultCommand],
        specific: {
            delay: {type: 'num', value: '50'},
            result: {type: 'at_end', value: ''}
        }
    };

    class deConzOut {
        constructor(config) {
            RED.nodes.createNode(this, config);

            let node = this;
            node.config = config;
            node.ready = false;

            node.cleanStatusTimer = null;
            node.status({});

            //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (!node.server) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/server:status.server_node_error"
                });
                return;
            }

            let initNode = function () {
                node.server.off('onStart', initNode);
                if (node.server.migrateNodeConfiguration(node)) {
                    // Make sure that all expected config are defined
                    node.config = Object.assign({}, defaultConfig, node.config);
                    node.ready = true;
                }
            };

            if (node.server.state.pooling.isValid === true) {
                (async () => {
                    await Utils.sleep(1500);
                    initNode();
                })().then().catch((error) => {
                    console.error(error);
                });
            } else {
                node.server.on('onStart', initNode);
            }

            node.on('input', (message_in, send, done) => {
                // For maximum backwards compatibility, check that send and done exists.
                send = send || function () {
                    node.send.apply(node, arguments);
                };
                done = done || function (err) {
                    if (err) node.error(err, message_in);
                };

                (async () => {
                    if (node.config.statustext_type === 'auto')
                        clearTimeout(node.cleanStatusTimer);

                    let waitResult = await Utils.waitForEverythingReady(node);
                    if (waitResult) {
                        done(RED._(waitResult));
                        return;
                    }

                    let delay = Utils.getNodeProperty(node.config.specific.delay, this, message_in);
                    if (typeof delay !== 'number') delay = 50;

                    let devices = [];
                    switch (node.config.search_type) {
                        case 'device':
                            for (let path of node.config.device_list) {
                                let device = node.server.device_list.getDeviceByPath(path);
                                if (device) {
                                    devices.push({data: device});
                                } else {
                                    done(`Error : Device not found : '${path}'`);
                                }
                            }
                            break;
                        case 'json':
                        case 'jsonata':
                            let querySrc = RED.util.evaluateJSONataExpression(
                                RED.util.prepareJSONataExpression(node.config.query, node),
                                message_in,
                                undefined
                            );
                            try {
                                for (let r of node.server.device_list.getDevicesByQuery(querySrc).matched) {
                                    devices.push({data: r});
                                }
                            } catch (e) {
                                node.status({
                                    fill: "red",
                                    shape: "dot",
                                    text: "node-red-contrib-deconz/server:status.query_error"
                                });
                                done(e.toString());
                                return;
                            }
                            break;
                    }

                    let resultMsgs = [];
                    let errorMsgs = [];
                    let resultTimings = ['never', 'after_command', 'at_end'];
                    let resultTiming = Utils.getNodeProperty(node.config.specific.result, this, message_in, resultTimings);
                    if (!resultTimings.includes(resultTiming)) resultTiming = 'never';

                    let command_count = node.config.commands.length;
                    for (const [command_id, saved_command] of node.config.commands.entries()) {
                        // Make sure that all expected config are defined
                        const command = Object.assign({}, defaultCommand, saved_command);
                        if (command.type === 'pause') {
                            let sleep_delay = Utils.getNodeProperty(command.arg.delay, this, message_in);
                            node.status({
                                fill: "blue",
                                shape: "dot",
                                text: RED._("node-red-contrib-deconz/server:status.out_commands.main")
                                    .replace('{{index}}', (command_id + 1).toString())
                                    .replace('{{count}}', command_count)
                                    .replace('{{status}}',
                                        RED._("node-red-contrib-deconz/server:status.out_commands.pause")
                                            .replace('{{delay}}', sleep_delay)
                                    )
                            });
                            await Utils.sleep(sleep_delay, 2000);
                            continue;
                        }

                        try {
                            let cp = new CommandParser(command, message_in, node);
                            let requests = cp.getRequests(node, devices);
                            let request_count = requests.length;
                            for (const [request_id, request] of requests.entries()) {
                                try {
                                    node.status({
                                        fill: "blue",
                                        shape: "dot",
                                        text: RED._("node-red-contrib-deconz/server:status.out_commands.main")
                                            .replace('{{index}}', (command_id + 1).toString())
                                            .replace('{{count}}', command_count)
                                            .replace('{{status}}',
                                                RED._("node-red-contrib-deconz/server:status.out_commands.request")
                                                    .replace('{{index}}', (request_id + 1).toString())
                                                    .replace('{{count}}', request_count)
                                            )
                                    });

                                    const response = await got(
                                        node.server.api.url.main() + request.endpoint,
                                        {
                                            method: 'PUT',
                                            retry: Utils.getNodeProperty(command.arg.retryonerror, this, message_in) || 0,
                                            json: request.params,
                                            responseType: 'json',
                                            timeout: 2000 // TODO make configurable ?
                                        }
                                    );

                                    if (resultTiming !== 'never') {
                                        let result = {};
                                        let errors = [];
                                        for (const r of response.body) {
                                            if (r.success !== undefined)
                                                for (const [enpointKey, value] of Object.entries(r.success))
                                                    result[enpointKey.replace(request.endpoint + '/', '')] = value;
                                            if (r.error !== undefined) errors.push(r.error);
                                        }

                                        let resultMsg = {};
                                        if (resultTiming === 'after_command') {
                                            resultMsg = Utils.cloneMessage(message_in, ['request', 'meta', 'payload', 'errors']);
                                            resultMsg.payload = result;
                                        } else if (resultTiming === 'at_end') {
                                            resultMsg.result = result;
                                        }

                                        resultMsg.request = request.params;
                                        resultMsg.meta = request.meta;
                                        if (request.scene_meta !== undefined)
                                            resultMsg.scene_meta = request.scene_meta;
                                        if (errors.length > 0)
                                            resultMsg.errors = errors;

                                        if (resultTiming === 'after_command') {
                                            send(resultMsg);
                                        } else if (resultTiming === 'at_end') {
                                            resultMsgs.push(resultMsg);
                                        }
                                    }

                                    let sleep_delay = delay - dotProp.get(response, 'timings.phases.total', 0);
                                    if (sleep_delay >= 200)
                                        node.status({
                                            fill: "blue",
                                            shape: "dot",
                                            text: RED._("node-red-contrib-deconz/server:status.out_commands.main")
                                                .replace('{{index}}', (command_id + 1).toString())
                                                .replace('{{count}}', command_count)
                                                .replace('{{status}}',
                                                    RED._("node-red-contrib-deconz/server:status.out_commands.delay")
                                                        .replace('{{delay}}', sleep_delay)
                                                )
                                        });
                                    await Utils.sleep(sleep_delay);

                                } catch (error) {
                                    if (resultTiming !== 'never') {
                                        let errorMsg = {};
                                        if (resultTiming === 'after_command') {
                                            errorMsg = Utils.cloneMessage(message_in, ['request', 'meta', 'payload', 'errors']);
                                        }

                                        errorMsg.request = request.params;
                                        errorMsg.meta = request.meta;
                                        errorMsg.errors = [{
                                            type: 0,
                                            code: dotProp.get(error, 'response.statusCode'),
                                            message: dotProp.get(error, 'response.statusMessage'),
                                            description: `${error.name}: ${error.message}`,
                                            apiEndpoint: request.endpoint
                                        }];

                                        if (resultTiming === 'after_command') {
                                            send(errorMsg);
                                        } else if (resultTiming === 'at_end') {
                                            resultMsgs.push(errorMsg);
                                        }
                                    }

                                    if (Utils.getNodeProperty(command.arg.aftererror, this, message_in, ['continue', 'stop']) === 'stop') return;

                                    if (error.timings !== undefined) {
                                        await Utils.sleep(delay - dotProp.get(error, 'timings.phases.total', 0));
                                    } else {
                                        await Utils.sleep(delay);
                                    }
                                }
                            }
                        } catch (error) {
                            node.error(`Error while processing command #${command_id + 1}, ${error}`, message_in);
                            console.warn(error);
                        }

                    }

                    if (resultTiming === 'at_end') {
                        let endMsg = Utils.cloneMessage(message_in, ['payload', 'errors']);
                        endMsg.payload = resultMsgs;
                        if (errorMsgs.length > 0)
                            endMsg.errors = errorMsgs;
                        send(endMsg);
                    }

                    node.server.updateNodeStatus(node, null);
                    if (node.config.statustext_type === 'auto')
                        node.cleanStatusTimer = setTimeout(function () {
                            node.status({}); //clean
                        }, 3000);

                    done();

                })().then().catch((error) => {
                    console.error(error);
                });

            });

        }

    }

    RED.nodes.registerType(NodeType, deConzOut);
};












