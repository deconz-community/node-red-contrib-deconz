module.exports = function(RED) {
    class deConzItemBattery {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;

            //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (node.server) {
                node.server.on('onClose', () => this.onClose());
                node.server.on('onSocketError', () => this.onSocketError());
                node.server.on('onSocketClose', () => this.onSocketClose());
                node.server.on('onSocketOpen', () => this.onSocketOpen());
                node.server.on('onSocketPongTimeout', () => this.onSocketPongTimeout());
                node.server.on('onNewDevice', (uniqueid) => this.onNewDevice(uniqueid));

                node.sendLastState();
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/battery:status.server_node_error"
                });
            }
        }


        sendState(device) {
            var node = this;

            if (device.state === undefined) {
                // console.log("CODE: #66");
                // console.log(device);
            } else {
                var battery = null;
                if ("config" in device && "battery" in device.config && device.config.battery !== undefined && device.config.battery != null) {
                    battery = device.config.battery;
                }

                //status
                if (battery) {

                    //status
                    if ("state" in device && "reachable" in device.state && device.state.reachable === false) {
                        node.status({
                            fill: "red",
                            shape: "ring",
                            text: "node-red-contrib-deconz/battery:status.not_reachable"
                        });
                    } else if ("config" in device && "reachable" in device.config && device.config.reachable === false) {
                        node.status({
                            fill: "red",
                            shape: "ring",
                            text: "node-red-contrib-deconz/battery:status.not_reachable"
                        });
                    } else {
                        node.status({
                            fill:  (battery >= 20)?((battery >= 50)?"green":"yellow"):"red",
                            shape: "dot",
                            text: battery+'%'
                        });
                    }


                    //outputs
                    node.send([
                        device.config,
                        node.formatHomeKit(device)
                    ]);
                }
            }
        }

        sendLastState() {
            var node = this;
            if (typeof (node.config.device) == 'string' && node.config.device.length) {
                var deviceMeta = node.server.getDevice(node.config.device);
                if (deviceMeta) {
                    node.server.devices[node.id] = deviceMeta.uniqueid;
                    node.meta = deviceMeta;
                    if (node.config.outputAtStartup) {
                        setTimeout(function(){
                            node.sendState(deviceMeta);
                        }, 1500); //we need this timeout after restart of node-red  (homekit delays)
                    }
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "node-red-contrib-deconz/battery:status.disconnected"
                    });
                }
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/battery:status.device_not_set"
                });
            }
        }

        formatHomeKit(device) {
            var msg = {};
            var characteristic = {};

            //battery status
            if ("config" in device) {
                if (device.config['battery'] !== undefined && device.config['battery'] != null){
                    characteristic.BatteryLevel = parseInt(device.config['battery']);
                    characteristic.StatusLowBattery = parseInt(device.config['battery'])<=15?1:0;

                    msg.payload = characteristic;
                    // msg.topic = "battery";
                    return msg;
                }
            }

            return null;
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
                text: "node-red-contrib-deconz/battery:status.reconnecting"
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
                text: "node-red-contrib-deconz/battery:status.disconnected"
            });
        }

        onSocketOpen() {
            var node = this;
            node.sendLastState();
        }

        onNewDevice(uniqueid) {
            var node = this;
            if (node.config.device === uniqueid) {
                node.sendLastState();
            }
        }

    }
    RED.nodes.registerType('deconz-battery', deConzItemBattery);
};


