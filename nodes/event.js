module.exports = function (RED) {
    class deConzItemEvent {
        constructor(config) {
            RED.nodes.createNode(this, config);

            let node = this;
            node.config = config;
            //node.cleanTimer = null;
            //node.status({}); //clean

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
            /*
            clearTimeout(node.cleanTimer);
            node.status({
                fill: "green",
                shape: "dot",
                text: "node-red-contrib-deconz/event:status.event"
            });
            node.cleanTimer = setTimeout(function () {
                node.status({}); //clean
            }, 3000);
             */
        }

    }

    RED.nodes.registerType('deconz-event', deConzItemEvent);
};
