const OutputMsgFormatter = require("../src/runtime/OutputMsgFormatter");
const ConfigMigration = require("../src/migration/ConfigMigration");

const NodeType = 'deconz-battery';
module.exports = function (RED) {

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
        output_rules: [{
            type: 'config',
            format: 'single',
            onstart: true
        }]
    };

    const defaultRule = {
        type: 'config',
        format: 'single',
        onstart: true
    };

    class deConzItemBattery {
        constructor(config) {
            RED.nodes.createNode(this, config);

            let node = this;
            node.config = config;

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
                    return;
                }

                // Make sure that all expected config are defined
                node.config = Object.assign({}, defaultConfig, node.config);

                if (node.config.search_type === 'device') {
                    node.config.device_list.forEach(function (item) {
                        node.server.registerNodeByDevicePath(node.config.id, item);
                    });
                } else {
                    node.server.registerNodeWithQuery(node.config.id);
                }

                node.server.updateNodeStatus(node, null);
            });
        }

        handleDeconzEvent(device, changed, rawEvent, opt) {
            let node = this;
            let msgs = new Array(this.config.output_rules.length);
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
        }

    }

    RED.nodes.registerType(NodeType, deConzItemBattery);
};


