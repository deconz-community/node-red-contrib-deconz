const DeconzHelper = require('../lib/DeconzHelper.js');
const dotProp = require('dot-prop');
const ConfigMigration = require("../src/migration/ConfigMigration");
const OutputMsgFormatter = require("../src/runtime/OutputMsgFormatter");

const NodeType = 'deconz-input';
module.exports = function (RED) {
    class deConzItemIn {
        constructor(config) {
            RED.nodes.createNode(this, config);

            let node = this;
            node.config = config;

            // Config migration
            let configMigration = new ConfigMigration(NodeType, node.config);
            let migrationResult = configMigration.applyMigration(node.config, node);
            if (Array.isArray(migrationResult.errors) && migrationResult.errors.length > 0) {
                migrationResult.errors.forEach(error => console.error(error));
            }

            // Format : {'state':{__PATH__ : {"buttonevent": 1002}}}
            //node.oldValues = {'state': {}, 'config': {} /*, 'name': false*/};

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

            if (node.config.search_type === "device") {
                node.config.device_list.forEach(function (item) {
                    node.server.registerNodeByDevicePath(node.config.id, item);
                });
            } else {
                node.server.registerNodeWithQuery(node.config.id);
            }

            node.status({
                fill: "blue",
                shape: "dot",
                text: "node-red-contrib-deconz/in:status.starting"
            });

            node.server.on('onStart', () => {
                // Display usefull info
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: "node-red-contrib-deconz/server:status.connected"
                });

                console.log('OnStart');
            });

        }

        handleDeconzEvent(device, changed, rawEvent, opt) {
            let node = this;
            let msgs = new Array(this.config.output_rules.length);
            let options = Object.assign({
                initialEvent: false,
                errorEvent: false
            }, opt);
            this.config.output_rules.forEach((rule, index) => {
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
                        msgs[index] = msg;
                        node.send(msgs);
                    }
                }

                //TODO display msg payload if it's possible (one rule and payload a non object value
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: "node-red-contrib-deconz/server:status.connected"
                });


            });
        }

    }

    RED.nodes.registerType(NodeType, deConzItemIn);
};


