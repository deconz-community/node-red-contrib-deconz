const OutputMsgFormatter = require("../src/runtime/OutputMsgFormatter");
const Utils = require("../src/runtime/Utils");
const got = require("got");

const NodeType = 'deconz-api';
module.exports = function (RED) {

    const defaultConfig = {
        name: "",
        topic: "",
        specific: {
            method: { type: 'GET' },
            endpoint: { type: 'str', value: '/' },
            payload: { type: 'json', value: '{}' }
        }
    };

    class deConzItemApi {
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
                    text: "node-red-contrib-deconz/battery:status.server_node_error"
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
                    let waitResult = await Utils.waitForEverythingReady(node);
                    if (waitResult) {
                        done(RED._(waitResult));
                        return;
                    }

                    // Load the config
                    let config = node.config;
                    let methods = ['GET', 'POST', 'PUT', 'DELETE'];
                    let method = Utils.getNodeProperty(config.specific.method, node, message_in, methods);
                    // Make sure the method is valid
                    if (!methods.includes(method)) method = 'GET';
                    let endpoint = Utils.getNodeProperty(config.specific.endpoint, node, message_in);
                    let payload = Utils.getNodeProperty(config.specific.payload, node, message_in);

                    // Add pending status
                    node.status({
                        fill: "blue",
                        shape: "dot",
                        text: "node-red-contrib-deconz/get:status.pending"
                    });

                    // Do request
                    const response = await node.server.api.doRequest(endpoint, { method, body: payload });

                    // Add output properties
                    let outputProperties = {
                        payload: response.body,
                        status: {
                            code: response.statusCode,
                            message: response.statusMessage,
                        }
                    };
                    let outputMsg = Utils.cloneMessage(message_in, Object.keys(outputProperties));
                    Object.assign(outputMsg, outputProperties);
                    outputMsg.topic = config.topic;

                    // Clear status timer
                    if (node.cleanStatusTimer) {
                        clearTimeout(node.cleanStatusTimer);
                        node.cleanStatusTimer = null;
                    }

                    // Set status
                    node.status({
                        fill: response.statusCode === 200 ? "green" : "red",
                        shape: "dot",
                        text: `${response.statusCode}: ${response.statusMessage}`
                    });

                    // Add status cleanup timer
                    node.cleanStatusTimer = setTimeout(function () {
                        node.status({}); //clean
                    }, 3000);

                    // Send the message
                    send(outputMsg);
                    done();

                })().then().catch((error) => {
                    console.error(error);
                });
            });

            node.on('close', (removed, done) => {
                done();
            });

        }

    }

    RED.nodes.registerType(NodeType, deConzItemApi);
};
