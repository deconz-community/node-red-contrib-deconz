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

                for (let command of node.config.commands) {
                    let cp = new CommandParser(command, message_in, node);
                    let requests = cp.getRequests(devices);
                    for (let request of requests) {

                        try {
                            const response = await got(
                                node.server.api.url[request.device_type].action(request.device_id),
                                {
                                    method: 'PUT',
                                    retry: 0,
                                    body: JSON.stringify(request.params)
                                }
                            );
                        } catch (error) {
                            console.log(error.response.body);
                            //=> 'Internal server error ...'
                        }

                        await Utils.sleep(delay); // TODO Don't wait on last element
                    }

                    await Utils.sleep(delay);
                    //TODO add delay
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












