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

            node.server.on('onStart', () => {
                // Config migration
                let configMigration = new ConfigMigration(NodeType, node.config, node.server);
                let migrationResult = configMigration.applyMigration(node.config, node);
                if (Array.isArray(migrationResult.errors) && migrationResult.errors.length > 0) {
                    migrationResult.errors.forEach(
                        error => console.error(`Error with migration of node ${node.type} with id ${node.id}`, error)
                    );
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
            });

            node.on('input', async (message_in) => {
                clearTimeout(node.cleanTimer);

                // Wait until the server is ready
                if (node.server.ready === false) {
                    await node.server.waitForReady();
                    if (node.server.ready === false) {
                        //TODO send error, the server is not ready
                        return;
                    }
                }
                //TODO wait for migration ?

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
                        for (let r of node.server.device_list.getDevicesByQuery(querySrc).matched) {
                            devices.push({data: r});
                        }
                        break;
                }

                node.config.output_rules.forEach((rule, index) => {
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
