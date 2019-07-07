module.exports = function(RED) {
    class deConzItemEvent {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;
            node.cleanTimer = null;
            node.status({}); //clean

            //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (!node.server) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: 'Server node error'
                });
            }
            node.server.devices[node.id] = 'event';

            node.sendLastState();
        }


        sendLastState() {
            this.status({});
        }
    }
    RED.nodes.registerType('deconz-event', deConzItemEvent);
};
