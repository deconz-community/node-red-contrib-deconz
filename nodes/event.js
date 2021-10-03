module.exports = function (RED) {
    class deConzItemEvent {
        constructor(config) {
            RED.nodes.createNode(this, config);

            let node = this;
            node.config = config;

            node.status({});

            //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (node.server) {
                node.server.registerEventNode(node.id);
            }

        }

        handleDeconzEvent(device, changed, rawEvent, opt) {
            let node = this;
            node.send({
                payload: rawEvent,
                meta: device
            });
        }

    }

    RED.nodes.registerType('deconz-event', deConzItemEvent);
};
