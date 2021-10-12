const OutputMsgFormatter = require("../src/runtime/OutputMsgFormatter");
const Utils = require("../src/runtime/Utils");

const NodeType = 'deconz-battery';
module.exports = function (RED) {

    const defaultRule = {
        type: 'config',
        format: 'single',
        onstart: true
    };

    const defaultConfig = {
        name: "",
        topic: "",
        statustext: "",
        statustext_type: 'auto',
        search_type: 'device',
        device_list: [],
        device_name: "",
        query: "{}",
        outputs: 1,
        output_rules: [defaultRule]
    };


    class deConzItemBattery {
        constructor(config) {
            RED.nodes.createNode(this, config);

            let node = this;
            node.config = config;
            node.ready = false;

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

            node.status({
                fill: "blue",
                shape: "dot",
                text: "node-red-contrib-deconz/server:status.starting"
            });

            let initNode = function () {
                node.server.off('onStart', initNode);
                if (node.server.migrateNodeConfiguration(node)) {
                    // Make sure that all expected config are defined
                    node.config = Object.assign({}, defaultConfig, node.config);
                    node.registerNode();
                    node.server.updateNodeStatus(node, null);
                    node.ready = true;
                }
            };

            if (node.server.state.pooling.isValid === true) {
                (async () => {
                    await Utils.sleep(1500);
                    initNode();
                    node.server.propagateStartNews([node.id]);
                })().then().catch((error) => {
                    console.error(error);
                });
            } else {
                node.server.on('onStart', initNode);
            }

            node.on('close', (removed, done) => {
                this.unregisterNode();
                done();
            });

        }

        registerNode() {
            let node = this;
            if (node.config.search_type === 'device') {
                node.config.device_list.forEach(function (item) {
                    node.server.registerNodeByDevicePath(node.config.id, item);
                });
            } else {
                node.server.registerNodeWithQuery(node.config.id);
            }
        }

        unregisterNode() {
            let node = this;
            if (node.config.search_type === "device") {
                node.config.device_list.forEach(function (item) {
                    node.server.unregisterNodeByDevicePath(node.config.id, item);
                });
            } else {
                node.server.unregisterNodeWithQuery(node.config.id);
            }
        }

        handleDeconzEvent(device, changed, rawEvent, opt) {
            let node = this;

            (async () => {
                let waitResult = await Utils.waitForEverythingReady(node);
                if (waitResult) return;

                let options = Object.assign({
                    initialEvent: false,
                    errorEvent: false
                }, opt);

                if (options.errorEvent === true) {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: options.errorCode || "Unknown Error"
                    });
                    if (options.isGlobalError === false)
                        node.error(options.errorMsg || "Unknown Error");
                    return;
                }

                let msgs = new Array(this.config.output_rules.length);
                this.config.output_rules.forEach((saved_rule, index) => {
                    // Make sure that all expected config are defined
                    const rule = Object.assign({}, defaultRule, saved_rule);
                    // Only if it's not on start and the start msg are blocked
                    if (!(options.initialEvent === true && rule.onstart !== true)) {
                        // Clean up old msgs
                        msgs.fill(undefined);

                        // Format msgs, can get one or many msgs.
                        let formatter = new OutputMsgFormatter(rule, NodeType, this.config);
                        let msgToSend = formatter.getMsgs({data: device, changed}, rawEvent, options);

                        // Make sure that the result is an array
                        if (!Array.isArray(msgToSend)) msgToSend = [msgToSend];

                        // Send msgs
                        for (let msg of msgToSend) {
                            msg.topic = this.config.topic;
                            msg = Object.assign(msg, msg.payload); // For retro-compatibility
                            msgs[index] = msg;
                            node.send(msgs);
                        }

                        // Update node status
                        if (index === 0)
                            node.server.updateNodeStatus(node, msgToSend);
                    }

                });
            })().then().catch((error) => {
                console.error(error);
            });
        }

    }

    RED.nodes.registerType(NodeType, deConzItemBattery);
};
