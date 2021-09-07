const ConfigMigration = require("../src/migration/ConfigMigration");
const OutputMsgFormatter = require("../src/runtime/OutputMsgFormatter");


const NodeType = 'deconz-get';
module.exports = function (RED) {
    class deConzItemGet {
        constructor(config) {
            RED.nodes.createNode(this, config);

            let node = this;

            node.config = config;
            node.cleanTimer = null;

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

            if (node.config.search_type === 'device' && node.config.device_list.length === 0) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/get:status.device_not_set"
                });
                return;
            }

            // Cleanup old status
            node.status({});

            node.on('input', function (message_in) {
                clearTimeout(node.cleanTimer);
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
                        //TODO implement
                        break;
                }

                node.config.output_rules.forEach((rule, index) => {
                    // Only if it's not on start and the start msg are blocked

                    // Clean up old msgs
                    msgs.fill(undefined);

                    // Format msgs, can get one or many msgs.
                    let formatter = new OutputMsgFormatter(rule, NodeType, node.config);
                    let msgToSend = formatter.getMsgs(devices, undefined, {src_msg: message_in});

                    // Make sure that the result is an array
                    if (!Array.isArray(msgToSend)) msgToSend = [msgToSend];

                    // Send msgs
                    for (let msg of msgToSend) {
                        msgs[index] = msg;
                        node.send(msgs);
                    }
                });

                // TODO Display something usefull ?
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: "node-red-contrib-deconz/get:status.received",
                });

                node.cleanTimer = setTimeout(function () {
                    node.status({}); //clean
                }, 3000);

            });
        }
    }

    RED.nodes.registerType(NodeType, deConzItemGet);
};
