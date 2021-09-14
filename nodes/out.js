const DeconzHelper = require('../lib/DeconzHelper.js');
const CommandParser = require("../src/runtime/CommandParser");
const Utils = require("../src/runtime/Utils");
const got = require('got');


module.exports = function (RED) {
    class deConzOut {
        constructor(config) {
            RED.nodes.createNode(this, config);

            let node = this;
            node.config = config;
            // TODO add config migration

            node.status({}); //clean

            //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (!node.server) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/in:status.server_node_error"
                });
                return;
            }

            node.cleanTimer = null;

            this.on('input', async (message_in, send, done) => {
                let delay = Utils.getNodeProperty(node.config.specific.delay, this, message_in);
                if (typeof delay !== 'number') delay = 50;

                //clearTimeout(node.cleanTimer);
                let devices = [];
                switch (node.config.search_type) {
                    case 'device':
                        for (let path of node.config.device_list) {
                            devices.push({data: node.server.device_list.getDeviceByPath(path)});
                        }
                        break;
                    case 'json':
                    case 'jsonata':
                        let querySrc = RED.util.evaluateJSONataExpression(
                            RED.util.prepareJSONataExpression(node.config.query, node),
                            message_in,
                            undefined
                        );
                        for (let r of node.server.device_list.getDevicesByQuery(querySrc).matched) {
                            devices.push({data: r});
                        }
                        break;
                }

                let resultMsgs = [];
                let errorMsgs = [];
                let resultTimings = ['never', 'after_command', 'at_end'];
                let resultTiming = Utils.getNodeProperty(node.config.specific.result, this, message_in, resultTimings);
                if (!resultTimings.includes(resultTiming)) resultTiming = 'never';

                for (const command of node.config.commands) {
                    try {
                        let cp = new CommandParser(command, message_in, node);
                        let requests = cp.getRequests(devices);
                        for (const request of requests) {
                            let endpoint = node.server.api.url[request.device_type].action(request.device_id);

                            try {
                                const response = await got(
                                    node.server.api.url.main() + endpoint,
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
                                                result[enpointKey.replace(endpoint + '/', '')] = value;
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
                                    if (errors.length > 0) {
                                        resultMsg.errors = errors;
                                    }

                                    if (resultTiming === 'after_command') {
                                        send(resultMsg);
                                    } else if (resultTiming === 'at_end') {
                                        resultMsgs.push(resultMsg);
                                    }
                                }
                                await Utils.sleep(delay - response.timings.phases.total);
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
                                        code: error.response.statusCode,
                                        message: error.response.statusMessage,
                                        description: `${error.name}: ${error.message}`,
                                        apiEndpoint: endpoint
                                    }];

                                    if (resultTiming === 'after_command') {
                                        send(errorMsg);
                                    } else if (resultTiming === 'at_end') {
                                        resultMsgs.push(errorMsg);
                                    }
                                }

                                if (Utils.getNodeProperty(command.arg.aftererror, this, message_in, ['continue', 'stop']) === 'stop') return;

                                await Utils.sleep(delay - error.timings.phases.total);
                            }
                        }
                    } catch (error) {
                        //TODO handle error
                    }

                }

                if (resultTiming === 'at_end') {
                    let endMsg = Utils.cloneMessage(message_in, ['payload', 'errors']);
                    endMsg.payload = resultMsgs;
                    if (errorMsgs.length > 0)
                        endMsg.errors = errorMsgs;
                    send(endMsg);
                }

            });

        }

        formatHomeKit(message, payload) {
            //TODO hap is deprecated
            if (message.hap.context === undefined) {
                return null;
            }

            var node = this;
            // var deviceMeta = node.server.getDevice(node.config.device);


            var msg = {};

            if (payload.On !== undefined) {
                msg['on'] = payload.On;
            } else if (payload.Brightness !== undefined) {
                msg['bri'] = DeconzHelper.convertRange(payload.Brightness, [0, 100], [0, 255]);
                if (payload.Brightness >= 254) payload.Brightness = 255;
                msg['on'] = payload.Brightness > 0
            } else if (payload.Hue !== undefined) {
                msg['hue'] = DeconzHelper.convertRange(payload.Hue, [0, 360], [0, 65535]);
                msg['on'] = true;
            } else if (payload.Saturation !== undefined) {
                msg['sat'] = DeconzHelper.convertRange(payload.Saturation, [0, 100], [0, 255]);
                msg['on'] = true;
            } else if (payload.ColorTemperature !== undefined) {
                msg['ct'] = DeconzHelper.convertRange(payload.ColorTemperature, [140, 500], [153, 500]);
                msg['on'] = true;
            } else if (payload.TargetPosition !== undefined) {
                msg['on'] = payload.TargetPosition > 0;
                msg['bri'] = DeconzHelper.convertRange(payload.TargetPosition, [0, 100], [0, 255]);
            }


            return msg;
        }
    }

    RED.nodes.registerType('deconz-output', deConzOut);
};












