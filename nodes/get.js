module.exports = function(RED) {
    class deConzItemGet {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;

            node.config = config;
            node.cleanTimer = null;

            //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (node.server) {
                node.server.devices[node.id] = node.config.device; //register node in devices list

                if (typeof (node.config.device) == 'string' && node.config.device.length) {
                    var deviceMeta = node.server.getDevice(node.config.device);
                    if (deviceMeta !== undefined && deviceMeta && "uniqueid" in deviceMeta) {
                        node.server.devices[node.id] = deviceMeta.uniqueid; //register node in devices list
                    } else {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "node-red-contrib-deconz/get:status.device_not_set"
                        });
                    }
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "node-red-contrib-deconz/get:status.device_not_set"
                    });
                }
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/get:status.server_node_error"
                });
            }

            if (typeof(config.device) == 'string'  && config.device.length) {
                node.status({}); //clean

                node.on('input', function (message_in) {
                    clearTimeout(node.cleanTimer);
                    var deviceMeta = node.server.getDevice(node.config.device);

                    if (deviceMeta) {
                        node.server.devices[node.id] = deviceMeta.uniqueid;
                        node.meta = deviceMeta;

                        //status
                        if ("state" in deviceMeta && deviceMeta.state !== undefined && "reachable" in deviceMeta.state && deviceMeta.state.reachable === false) {
                            node.status({
                                fill: "red",
                                shape: "ring",
                                text: "node-red-contrib-deconz/get:status.not_reachable"
                            });
                        } else if ("config" in deviceMeta && deviceMeta.config !== undefined && "reachable" in deviceMeta.config && deviceMeta.config.reachable === false) {
                            node.status({
                                fill: "red",
                                shape: "ring",
                                text: "node-red-contrib-deconz/get:status.not_reachable"
                            });
                        } else {
                            node.status({
                                fill: "green",
                                shape: "dot",
                                text: (config.state in node.meta.state)?(node.meta.state[config.state]).toString():"node-red-contrib-deconz/get:status.received",
                            });

                            node.send({
                                payload:(config.state in node.meta.state)?node.meta.state[config.state]:node.meta.state,
                                payload_in: message_in.payload,
                                meta:deviceMeta,
                            });
                        }

                        node.cleanTimer = setTimeout(function(){
                            node.status({}); //clean
                        }, 3000);
                    } else {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "node-red-contrib-deconz/get:status.device_not_set"
                        });
                    }

                });
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/get:status.device_not_set"
                });
            }
        }
    }

    RED.nodes.registerType('deconz-get', deConzItemGet);
};
