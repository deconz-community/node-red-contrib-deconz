const DeconzHelper = require('../lib/DeconzHelper.js');


module.exports = function(RED) {
    class deConzItemIn {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.lastSendTimestamp = null;
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

                node.sendLastState(); //tested for duplicate send with onSocketOpen
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/in:status.server_node_error"
                });
            }
        }


        sendLastState() {
            var node = this;
            if (typeof (node.config.device) == 'string' && node.config.device.length) {
                var deviceMeta = node.server.getDevice(node.config.device);
                if (deviceMeta !== undefined && deviceMeta && "uniqueid" in deviceMeta) {
                    node.server.devices[node.id] = deviceMeta.uniqueid;
                    node.meta = deviceMeta;
                    if (node.config.outputAtStartup) {
                        setTimeout(function () {
                            node.sendState(deviceMeta,true);
                        }, 1500); //we need this timeout after restart of node-red  (homekit delays)
                    } else {
                        setTimeout(function () {
                            node.status({}); //clean
                            node.getState(deviceMeta);
                            node.sendStateHomekitOnly(deviceMeta); //always send for homekit
                        }, 1500); //update status with the same delay
                    }
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "node-red-contrib-deconz/in:status.disconnected"
                    });
                }
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/in:status.device_not_set"
                });
            }
        }

        getState(device) {
            var node = this;

            if (device.state === undefined) {
                return;
                // console.log("CODE: #66");
                // console.log(device);
            } else {
                //status
                if ("state" in device && "reachable" in device.state && device.state.reachable === false) {
                    node.status({
                        fill: "red",
                        shape: "ring",
                        text: "node-red-contrib-deconz/in:status.not_reachable"
                    });
                } else if ("config" in device && "reachable" in device.config && device.config.reachable === false) {
                    node.status({
                        fill: "red",
                        shape: "ring",
                        text: "node-red-contrib-deconz/in:status.not_reachable"
                    });
                } else {
                    var nodeState = (node.config.state in device.state) ? (device.state[node.config.state]) : null;
                    node.status({
                        fill: "green",
                        shape: "dot",
                        text: nodeState !== null ? nodeState.toString() : "node-red-contrib-deconz/in:status.connected"
                    });
                }
                if (node.oldState === undefined && device.state[node.config.state]) { node.oldState = device.state[node.config.state]; }
                if (node.prevUpdateTime === undefined && device.state['lastupdated']) { node.prevUpdateTime = device.state['lastupdated']; }
                return(device)
            }
        };

        sendState(device,force=false) {
            var node = this;
            device = node.getState(device);
            if(!device) { return; }

            //filter output
            if (!force && 'onchange' === node.config.output && device.state[node.config.state] === node.oldState) return;
            if (!force && 'onupdate' === node.config.output && device.state['lastupdated'] === node.prevUpdateTime) return;

            //outputs
            node.send([
                {
                    topic: node.config.topic,
                    payload: (node.config.state in device.state) ? device.state[node.config.state] : device.state,
                    payload_raw: device,
                    meta: node.server.getDevice(node.config.device)
                },
                node.formatHomeKit(device)
            ]);

            node.oldState = device.state[node.config.state];
            node.prevUpdateTime = device.state['lastupdated'];
            node.lastSendTimestamp = new Date().getTime();
        };


        sendStateHomekitOnly(device) {
            var node = this;
            device = node.getState(device);
            if(!device) { return; }

            //outputs
            node.send([
                null,
                node.formatHomeKit(device)
            ]);
        };

        formatHomeKit(device, options) {
            var node = this;
            var state = device.state;
            var config = device.config;
            var deviceMeta = node.server.getDevice(node.config.device);

            var no_reponse = false;
            if (state !== undefined && state['reachable'] !== undefined && state['reachable'] != null && state['reachable'] === false) {
                no_reponse = true;
            }
            if (config !== undefined && config['reachable'] !== undefined && config['reachable'] != null && config['reachable'] === false) {
                no_reponse = true;
            }
            if (options !== undefined && "reachable" in options && !options['reachable']) {
                no_reponse = true;
            }

            var msg = {};
// console.log(device.state);
// console.log(new Date().getTime()-node.lastSendTimestamp);
            var characteristic = {};
            if (state !== undefined){
                //by types
                if ("type" in deviceMeta && (deviceMeta.type).toLowerCase() === 'window covering device') {
                    characteristic.CurrentPosition = Math.ceil(state['bri']/2.55);
                    characteristic.TargetPosition = Math.ceil(state['bri']/2.55);
                    if (no_reponse) {
                        characteristic.CurrentPosition = "NO_RESPONSE";
                        characteristic.TargetPosition = "NO_RESPONSE";
                    }

                //by params
                } else {

                    if (state['temperature'] !== undefined) {
                        characteristic.CurrentTemperature = state['temperature'] / 100;
                        if (no_reponse) characteristic.CurrentTemperature = "NO_RESPONSE";
                    }

                    if (state['humidity'] !== undefined) {
                        characteristic.CurrentRelativeHumidity = state['humidity'] / 100;
                        if (no_reponse) characteristic.CurrentRelativeHumidity = "NO_RESPONSE";
                    }

                    if (state['lux'] !== undefined) {
                        characteristic.CurrentAmbientLightLevel = state['lux'];
                        if (no_reponse) characteristic.CurrentAmbientLightLevel = "NO_RESPONSE";
                    }

                    if (state['fire'] !== undefined) {
                        characteristic.SmokeDetected = state['fire'];
                        if (no_reponse) characteristic.SmokeDetected = "NO_RESPONSE";
                    }

                    if (state['buttonevent'] !== undefined) {
                        //https://github.com/dresden-elektronik/deconz-rest-plugin/wiki/Xiaomi-WXKG01LM
                        // Event        Button        Action
                        // 1000            One            initial press
                        // 1001           One            single hold
                        // 1002            One            single short release
                        // 1003            One            single hold release
                        // 1004           One            double short press
                        // 1005            One            triple short press
                        // 1006            One            quad short press
                        // 1010            One            five+ short press
                        if ([1002, 2002, 3002, 4002, 5002, 6002].indexOf(state['buttonevent']) >= 0) characteristic.ProgrammableSwitchEvent = 0;
                        else if ([1004, 2004, 3004, 4004, 5004, 6004].indexOf(state['buttonevent']) >= 0) characteristic.ProgrammableSwitchEvent = 1;
                        else if ([1001, 2001, 3001, 4001, 5001, 6001].indexOf(state['buttonevent']) >= 0) characteristic.ProgrammableSwitchEvent = 2;
                        else if ([1005, 2005, 3005, 4005, 5005, 6005].indexOf(state['buttonevent']) >= 0) characteristic.ProgrammableSwitchEvent = 3;
                        else if ([1006, 2006, 3006, 4006, 5006, 6006].indexOf(state['buttonevent']) >= 0) characteristic.ProgrammableSwitchEvent = 4;
                        else if ([1010, 2010, 3010, 4010, 5010, 6010].indexOf(state['buttonevent']) >= 0) characteristic.ProgrammableSwitchEvent = 5;
                        if (no_reponse) characteristic.ProgrammableSwitchEvent = "NO_RESPONSE";


                        //index of btn
                        if ([1001, 1002, 1004, 1005, 1006, 1010].indexOf(state['buttonevent']) >= 0) characteristic.ServiceLabelIndex = 1;
                        else if ([2001, 2002, 2004, 2005, 2006, 2010].indexOf(state['buttonevent']) >= 0) characteristic.ServiceLabelIndex = 2;
                        else if ([3001, 3002, 3004, 3005, 3006, 3010].indexOf(state['buttonevent']) >= 0) characteristic.ServiceLabelIndex = 3;
                        else if ([4001, 4002, 4004, 4005, 4006, 4010].indexOf(state['buttonevent']) >= 0) characteristic.ServiceLabelIndex = 4;
                        else if ([5001, 5002, 5004, 5005, 5006, 5010].indexOf(state['buttonevent']) >= 0) characteristic.ServiceLabelIndex = 5;
                        else if ([6001, 6002, 6004, 6005, 6006, 6010].indexOf(state['buttonevent']) >= 0) characteristic.ServiceLabelIndex = 6;
                    }

                    // if (state['consumption'] !== null){
                    //     characteristic.OutletInUse = state['consumption'];
                    // }

                    if (state['power'] !== undefined) {
                        characteristic.OutletInUse = state['power'] > 0;
                        if (no_reponse) characteristic.OutletInUse = "NO_RESPONSE";
                    }

                    if (state['water'] !== undefined) {
                        characteristic.LeakDetected = state['water'] ? 1 : 0;
                        if (no_reponse) characteristic.LeakDetected = "NO_RESPONSE";
                    }

                    if (state['presence'] !== undefined) {
                        characteristic.MotionDetected = state['presence'];
                        if (no_reponse) characteristic.MotionDetected = "NO_RESPONSE";
                    }

                    if (state['open'] !== undefined) {
                        characteristic.ContactSensorState = state['open'] ? 1 : 0;
                        if (no_reponse) characteristic.ContactSensorState = "NO_RESPONSE";
                    }

                    if (state['vibration'] !== undefined) {
                        characteristic.ContactSensorState = state['vibration'] ? 1 : 0;
                        if (no_reponse) characteristic.ContactSensorState = "NO_RESPONSE";
                    }

                    if (state['on'] !== undefined) {
                        characteristic.On = state['on'];
                        if (no_reponse) characteristic.On = "NO_RESPONSE";
                    }

                    if (state['bri'] !== undefined) {
                        characteristic.Brightness = DeconzHelper.convertRange(state['bri'], [0,255], [0,100]);
                        if (no_reponse) characteristic.Brightness = "NO_RESPONSE";
                    }

                    //colors
                    // if (state['colormode'] === 'hs' || state['colormode'] === 'xy') {
                        if (state['hue'] !== undefined) {
                            characteristic.Hue = DeconzHelper.convertRange(state['hue'], [0, 65535], [0, 360]);
                            if (no_reponse) characteristic.Hue = "NO_RESPONSE";
                        }

                        if (state['sat'] !== undefined) {
                            characteristic.Saturation = DeconzHelper.convertRange(state['sat'], [0, 255], [0, 100]);
                            if (no_reponse) characteristic.Saturation = "NO_RESPONSE";
                        }

                    // } else if (state['colormode'] === 'ct') {
                        if (state['ct'] !== undefined) { //lightbulb bug: use hue or ct
                            characteristic.ColorTemperature = DeconzHelper.convertRange(state['ct'], [153, 500], [140, 500]);
                            if (no_reponse) characteristic.ColorTemperature = "NO_RESPONSE";
                        }
                    // }

                }
            }

            //battery status
            if (config !== undefined) {
                if (config['battery'] !== undefined && config['battery'] != null){

                    if (device.type !== 'ZHASwitch') { //exclude
                        characteristic.StatusLowBattery = parseInt(device.config['battery']) <= 15 ? 1 : 0;
                        if (no_reponse) characteristic.StatusLowBattery = "NO_RESPONSE";
                    }
                }
            }

            if (Object.keys(characteristic).length === 0) return null; //empty response

            msg.topic = node.config.topic;
            msg.payload = characteristic;
            return msg;
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
                text: "node-red-contrib-deconz/in:status.reconnecting"
            });

            //send NO_RESPONSE
            var deviceMeta = node.server.getDevice(node.config.device);
            if (deviceMeta) {
                node.send([
                    null,
                    node.formatHomeKit(deviceMeta, {reachable:false})
                ]);
            }
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
                text: "node-red-contrib-deconz/in:status.disconnected"
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
    RED.nodes.registerType('deconz-input', deConzItemIn);
};


