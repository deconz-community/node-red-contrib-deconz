module.exports = function(RED) {
    class deConzItemGet {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;

            node.config = config;
            node.cleanTimer = null;

            //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (!node.server) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: 'Server node error'
                });
            }


            if (typeof(config.device) == 'string'  && config.device.length) {
                node.status({}); //clean

                node.on('input', function (message) {
                    clearTimeout(node.cleanTimer);

                    node.server.getDeviceMeta(function(deviceMeta){
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
                                    text: (config.state in node.meta.state)?(node.meta.state[config.state]?node.meta.state[config.state]:'false'):"received",
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
                    }, node.config.device);

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






