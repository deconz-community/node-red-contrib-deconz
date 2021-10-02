const ConfigMigration = require("../src/migration/ConfigMigration");
const OutputMsgFormatter = require("../src/runtime/OutputMsgFormatter");


const NodeType = 'deconz-get';
module.exports = function (RED) {

    const defaultRule = {
        type: 'state',
        format: 'single'
    };

    const defaultConfig = {
        name: "",
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
                    node.error(
                        `Error with migration of node ${node.type} with id ${node.id}\n` +
                        error.join('\n') +
                        '\nPlease open the node settings and update the configuration'
                    );
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "node-red-contrib-deconz/server:status.migration_error"
                    });
                }

                // Make sure that all expected config are defined
                node.config = Object.assign({}, defaultConfig, node.config);

                node.server.updateNodeStatus(node, null);
            });

            node.on('input', async (message_in) => {
                // Wait until the server is ready
                if (node.server.ready === false) {
                    node.status({
                        fill: "yellow",
                        shape: "dot",
                        text: "node-red-contrib-deconz/server:status.wait_for_server_start"
                    });
                    await node.server.waitForReady();
                    if (node.server.ready === false) {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "node-red-contrib-deconz/server:status.server_node_error"
                        });
                        //TODO send error, the server is not ready
                        return;
                    } else {
                        node.status({});
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
                        node.send(msgs);
                    }

                    // Update node status
                    if (index === 0)
                        node.server.updateNodeStatus(node, msgToSend);
                });

            });
        }
    }

    RED.nodes.registerType(NodeType, deConzItemGet);
};
