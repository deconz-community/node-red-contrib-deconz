const OutputMsgFormatter = require("../src/runtime/OutputMsgFormatter");
const Utils = require("../src/runtime/Utils");

const NodeType = 'deconz-api';
module.exports = function (RED) {

    const defaultConfig = {
        name: "",
        topic: "",
    };

    class deConzItemApi {
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

            node.on('close', (removed, done) => {
                done();
            });

        }

    }

    RED.nodes.registerType(NodeType, deConzItemApi);
};
