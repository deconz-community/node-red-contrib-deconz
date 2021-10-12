const ConfigMigration = require("../src/migration/ConfigMigration");
const OutputMsgFormatter = require("../src/runtime/OutputMsgFormatter");
const dotProp = require("dot-prop");
const Utils = require("../src/runtime/Utils");


const NodeType = 'deconz-get';
module.exports = function (RED) {

    const defaultRule = {
        type: 'state',
        format: 'single'
    };

    const defaultConfig = {
        name: "",
        statustext: "",
        statustext_type: 'auto',
        search_type: 'device',
        device_list: [],
        device_name: "",
        query: "{}",
        outputs: 1,
        output_rules: [defaultRule],
    };

    class deConzItemGet {
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
                    text: "node-red-contrib-deconz/get:status.server_node_error"
                });
                return;
            }

            let initNode = function () {
                node.server.off('onStart', initNode);
                if (node.server.migrateNodeConfiguration(node)) {
                    // Make sure that all expected config are defined
                    node.config = Object.assign({}, defaultConfig, node.config);
                    node.server.updateNodeStatus(node, null);
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
                    let waitResult = await Utils.waitForEverythingReady(node);
                    if (waitResult) {
                        done(RED._(waitResult));
                        return;
                    }

                    let unreachableDevices = [];
                    let msgs = new Array(this.config.output_rules.length);
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

                    node.config.output_rules.forEach((saved_rule, index) => {
                        // Make sure that all expected config are defined
                        const rule = Object.assign({}, defaultRule, saved_rule);

                        // Only if it's not on start and the start msg are blocked

                        // Clean up old msgs
                        msgs.fill(undefined);

                        // Format msgs, can get one or many msgs.
                        let formatter = new OutputMsgFormatter(rule, NodeType, node.config);
                        let msgToSend = formatter.getMsgs(devices, undefined, {
                            src_msg: RED.util.cloneMessage(message_in)
                        });

                        // Make sure that the result is an array
                        if (!Array.isArray(msgToSend)) msgToSend = [msgToSend];

                        // Send msgs
                        for (let msg of msgToSend) {
                            msgs[index] = msg;
                            send(msgs);
                            if (dotProp.get(msg, 'meta.state.reachable') === false ||
                                dotProp.get(msg, 'meta.config.reachable') === false
                            ) {
                                let device_path = dotProp.get(msg, 'meta.device_path');
                                if (device_path && !unreachableDevices.includes(device_path)) {
                                    done(`Device "${dotProp.get(msg, 'meta.name')}" is not reachable.`);
                                    unreachableDevices.push(device_path);
                                }
                            }
                        }

                        // Update node status
                        if (index === 0)
                            node.server.updateNodeStatus(node, msgToSend);
                    });
                    if (node.config.statustext_type === 'auto')
                        node.cleanStatusTimer = setTimeout(function () {
                            node.status({}); //clean
                        }, 3000);

                    if (unreachableDevices.length === 0) done();
                })().then().catch((error) => {
                    console.error(error);
                });
            });
        }
    }

    RED.nodes.registerType(NodeType, deConzItemGet);
};
