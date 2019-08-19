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
            if (node.server) {
                node.server.devices[node.id] = 'event';

                node.server.on('onClose', () => this.onClose());
                node.server.on('onSocketError', () => this.onSocketError());
                node.server.on('onSocketClose', () => this.onSocketClose());
                node.server.on('onSocketOpen', () => this.onSocketOpen());
                node.server.on('onSocketMessage', (data) => this.onSocketMessage(data));
                node.server.on('onSocketPongTimeout', () => this.onSocketPongTimeout());
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/event:status.server_node_error"
                });
            }

            node.sendLastState();
        }


        sendLastState() {
            var node = this;
            node.status({});
        }

        onSocketPongTimeout() {
            var node = this;
            node.onSocketError();
        }

        onSocketError() {
            var node = this;
            node.status({
                fill: "yellow",
                shape: "dot",
                text: "node-red-contrib-deconz/event:status.reconnecting"
            });
        }

        onClose() {
            var node = this;
            node.onSocketClose();
        }

        onSocketClose() {
            var node = this;
            node.status({
                fill: "red",
                shape: "dot",
                text: "node-red-contrib-deconz/event:status.disconnected"
            });
        }

        onSocketOpen() {
            var node = this;
            node.sendLastState();
        }

        onSocketMessage(data) {
            var node = this;
            // console.log(data);
            if ("t" in data && data.t === "event") {
                node.send({'payload': data});
                clearTimeout(node.cleanTimer);
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: "node-red-contrib-deconz/event:status.event"
                });
                node.cleanTimer = setTimeout(function () {
                    node.status({}); //clean
                }, 3000);
            }

        }

    }
    RED.nodes.registerType('deconz-event', deConzItemEvent);
};
