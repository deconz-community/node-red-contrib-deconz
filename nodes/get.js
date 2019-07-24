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
                if (typeof (node.config.device) == 'string' && node.config.device.length) {
                    var deviceMeta = node.server.getDevice(node.config.device);
                    if (deviceMeta !== undefined && deviceMeta && "uniqueid" in deviceMeta) {
                        node.server.devices[node.id] = deviceMeta.uniqueid; //regisgter node in devices list
                    } else {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: 'Error'
                        });
                    }
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: 'device not set'
                    });
                }
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: 'server node error'
                });
            }

            if (typeof(config.device) == 'string'  && config.device.length) {
                node.status({}); //clean

                node.on('input', function (message) {
                    clearTimeout(node.cleanTimer);
                    var deviceMeta = node.server.getDevice(node.config.device);

                    if (deviceMeta) {
                        node.server.devices[node.id] = deviceMeta.uniqueid;
                        node.meta = deviceMeta;

                        //status
                        if ("state" in deviceMeta && "reachable" in deviceMeta.state && deviceMeta.state.reachable === false) {
                            node.status({
                                fill: "red",
                                shape: "ring",
                                text: "not reachable"
                            });
                        } else if ("config" in deviceMeta && "reachable" in deviceMeta.config && deviceMeta.config.reachable === false) {
                            node.status({
                                fill: "red",
                                shape: "ring",
                                text: "not reachable"
                            });
                        } else {
                            node.status({
                                fill: "green",
                                shape: "dot",
                                text: (config.state in node.meta.state)?(node.meta.state[config.state]).toString():"received",
                            });

                            node.send({
                                payload:(config.state in node.meta.state)?node.meta.state[config.state]:node.meta.state,
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
                            text: 'Device not found'
                        });
                    }

                });
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: 'Device not set'
                });
            }
        }
    }

    RED.nodes.registerType('deconz-get', deConzItemGet);
};
