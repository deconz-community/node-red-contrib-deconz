module.exports = function (RED) {
    class deConzItemEvent {
        constructor(config) {
            RED.nodes.createNode(this, config);

            let node = this;
            node.config = config;

            node.status({
                fill: "blue",
                shape: "dot",
                text: "node-red-contrib-deconz/server:status.starting"
            });

            //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (node.server) {
                node.server.registerEventNode(node.id);
            }

        }

        handleDeconzEvent(device, changed, rawEvent, opt) {
            let node = this;
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

            node.send({
                payload: rawEvent,
                meta: device
            });
        }

    }

    RED.nodes.registerType('deconz-event', deConzItemEvent);
};
