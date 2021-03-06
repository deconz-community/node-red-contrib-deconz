const DeconzHelper = require('../lib/DeconzHelper.js');
const dotProp = require('dot-prop');

module.exports = function (RED) {
    class deConzItemIn {
        constructor(config) {
            RED.nodes.createNode(this, config);

            let node = this;
            node.lastSendTimestamp = null;
            node.config = config;
            node.updateOldSettings();

            // Format : {__PATH__ : {"buttonevent": 1002}}
            node.oldStates = {'state': {}, 'config': {}};

            //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (node.server) {

                node.status({
                    fill: "blue",
                    shape: "dot",
                    text: "node-red-contrib-deconz/in:status.starting"
                });

                node.server.on('onClose', () => this.onClose());
                node.server.on('onSocketError', () => this.onSocketError());
                node.server.on('onSocketClose', () => this.onSocketClose());
                node.server.on('onSocketOpen', () => this.onSocketOpen());
                node.server.on('onSocketPongTimeout', () => this.onSocketPongTimeout());
                node.server.on('onNewDevice', (resource, object_index, init) => this.onNewDevice(resource, object_index, init));

                if (node.config.search_type === "device") {
                    node.config.device_list.forEach(function (item) {
                        node.server.registerNodeByDevicePath(node.config.id, item)
                    });
                } else {
                    node.server.registerNodeWithQuery(node.config.id)
                }

            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/in:status.server_node_error"
                });
            }
        }

        updateOldSettings() {
            let node = this;

            // Handle old device save format
            if (typeof (node.config.device) == 'string' && node.config.device.length) {
                let device = node.server.getDevice(node.config.device);
                if (device) {
                    node.config.device_list = [node.server.getPathByDevice(device)];
                } else {
                    node.config.device_list = [];
                }
            }

            // Handle old state save format
            if (!Array.isArray(node.config.state)) {
                node.config.state = [node.config.state];
            }

            if (node.config.config_output === undefined) {
                node.config.config_output = "always";
            }

        }

        sendLastState() {
            let node = this;
            if (node.config.search_type === "device") {
                node.config.device_list.forEach(function (item) {
                    let deviceMeta = node.server.getDeviceByPath(item);
                    node.send(deviceMeta, true, true, true);
                });
            } else {
                //TODO handle queries
            }


            //console.log(node.config)


            if (typeof (node.config.device) == 'string' && node.config.device.length) {

            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/in:status.device_not_set"
                });
            }
        }

        getStatePayload(device) {
            let node = this;
            return (node.config.state in device.state) ? device.state[node.config.state] : device.state;
        }


        setStateCache(device_path, state, value) {
            let node = this;
            if (!(device_path in node.oldStates)) node.oldStates[device_path] = {};
            node.oldStates[device_path][state] = value;
        }

        getStateCache(device_path, state) {
            let node = this;
            if (!(device_path in node.oldStates)) return undefined;
            return node.oldStates[device_path][state];
        }

        checkAndUpdateStateCache(device_path, state, newValue) {
            let node = this;
            let prev = node.getStateCache(device_path, state)
            if (prev !== newValue) {
                node.setStateCache(device_path, state, value)
                return true;
            } else {
                return false;
            }
        }

        updateNodeStatus(device) {
            let node = this;

            if (device.state === undefined) {
                return;
                // console.log("CODE: #66");
                // console.log(device);
            }
            //status
            if (dotProp.has(device, 'state.reachable') && device.state.reachable === false) {
                node.status({
                    fill: "red",
                    shape: "ring",
                    text: "node-red-contrib-deconz/in:status.not_reachable"
                });
            } else if (dotProp.has(device, 'config.reachable') && device.config.reachable === false) {
                node.status({
                    fill: "red",
                    shape: "ring",
                    text: "node-red-contrib-deconz/in:status.not_reachable"
                });
            } else {

                //TODO maybe check if it's an array first or change it in migration config
                let nodeState;
                if (!(node.config.state.includes('0') || node.config.state.includes('1') || node.config.state.length > 1)) {
                    nodeState = dotProp.get(device, 'state.' + node.config.state[0]);
                }
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: nodeState !== undefined ? nodeState.toString() : "node-red-contrib-deconz/in:status.connected"
                });
            }
        };

        sendState(device, force = false, sendState = true, sendHomekit = true, raw_payload = undefined) {
            let node = this;
            if (sendState === false && sendHomekit === false) return;
            //console.log("sendState!")

            node.updateNodeStatus(device);

            let device_path = node.server.getPathByDevice(device);

            let changed = {};
            // Check if I should send to output
            if (!force) {
                ['config', 'state'].forEach(function (key) {
                    /*
                    if (dotProp.has(device, 'state')) {
                        Object.keys(dotProp.get(device, key)).forEach(function (state_name) {
                            let newValuePath = key + '.' + state_name;
                            let oldValuePath = key + '.' + device_path + '.' + state_name

                            let newValue = dotProp.get(device, newValuePath);
                            let oldValue = dotProp.get(node.oldStates, oldValuePath);

                            if (newValue !== oldValue) {
                                if (!(key in changed)) changed[key] = [];
                                changed[key].push(state_name)
                                dotProp.set(node.oldStates, oldValuePath, newValue)
                            }
                        })
                    }

                     */
                })
            }


            //TODO fix state changes
            /*
            device = node.getState(device);
            if (!device) return;
            //filter output
            if (!force && 'onchange' === node.config.output && device.state[node.config.state] === node.oldState) return;
            if (!force && 'onupdate' === node.config.output && device.state['lastupdated'] === node.prevUpdateTime) return;
             */

            //TODO handle state format

            let output = [undefined, undefined];
            if (sendState) {
                output[0] = {
                    topic: node.config.topic,
                    //payload: (node.config.state in device.state) ? device.state[node.config.state] : device.state,
                    payload: node.getStatePayload(device),
                    payload_raw: raw_payload || device,
                    meta: device
                };
            }

            if (sendHomekit) output[1] = node.formatHomeKit(device)
            //outputs
            node.send(output);

            node.oldState = device.state[node.config.state];
            node.prevUpdateTime = device.state['lastupdated'];
            node.lastSendTimestamp = new Date().getTime();
        };

        formatHomeKit(device, options) {
            return {};

            let node = this;
            let state = device.state;
            let config = device.config;
            let deviceMeta = node.server.getDevice(node.config.device);

            let no_reponse = false;
            if (state !== undefined && state['reachable'] !== undefined && state['reachable'] != null && state['reachable'] === false) {
                no_reponse = true;
            }
            if (config !== undefined && config['reachable'] !== undefined && config['reachable'] != null && config['reachable'] === false) {
                no_reponse = true;
            }
            if (options !== undefined && "reachable" in options && !options['reachable']) {
                no_reponse = true;
            }

            let msg = {};
// console.log(device.state);
// console.log(new Date().getTime()-node.lastSendTimestamp);
            let characteristic = {};
            if (state !== undefined) {
                //by types
                if ("type" in deviceMeta && (deviceMeta.type).toLowerCase() === 'window covering device') {
                    characteristic.CurrentPosition = Math.ceil(state['bri'] / 2.55);
                    characteristic.TargetPosition = Math.ceil(state['bri'] / 2.55);
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
                        characteristic.Brightness = DeconzHelper.convertRange(state['bri'], [0, 255], [0, 100]);
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
                if (config['battery'] !== undefined && config['battery'] != null) {

                    if (device.type !== 'ZHASwitch') { //exclude
                        characteristic.StatusLowBattery = parseInt(device.config['battery']) <= 15 ? 1 : 0;
                        if (no_reponse) characteristic.StatusLowBattery = "NO_RESPONSE";
                    }
                }
            }

            if (Object.keys(characteristic).length === 0) return null; //empty response

            msg.topic = node.config.topic;
            msg.lastupdated = device.state['lastupdated'];
            msg.payload = characteristic;
            return msg;
        }

        onSocketPongTimeout() {
            let node = this;
            node.onSocketError();
        }

        onSocketError() {
            let node = this;
            node.status({
                fill: "yellow",
                shape: "dot",
                text: "node-red-contrib-deconz/in:status.reconnecting"
            });

            //send NO_RESPONSE
            let deviceMeta = node.server.getDevice(node.config.device);
            if (deviceMeta) {
                node.send([
                    null,
                    node.formatHomeKit(deviceMeta, {reachable: false})
                ]);
            }
        }

        onClose() {
            let node = this;
            node.onSocketClose();
        }

        onSocketClose() {
            let node = this;
            node.status({
                fill: "red",
                shape: "dot",
                text: "node-red-contrib-deconz/in:status.disconnected"
            });
        }

        onSocketOpen() {
            let node = this;
            node.sendLastState();
        }


        onNewDevice(resource, object_index, initialDiscovery) {
            let node = this;
            let device = node.server.items[resource][object_index];

            let sendState = function () {
                if (initialDiscovery) {
                    setTimeout(function () {
                        node.sendState(device, true, node.config.outputAtStartup, true);
                    }, 1500); //we need this timeout after restart of node-red  (homekit delays)
                } else {
                    node.sendState(device, true);
                }
            }

            if (node.config.search_type === "device") {
                if (node.config.device_list.includes(resource + "/" + object_index)) {
                    sendState();
                }
            } else {
                let query = RED.util.evaluateNodeProperty(
                    node.config.query,
                    node.config.search_type,
                    RED.nodes.getNode(node.config.id), // TODO Maybe I can use `node` directly
                    {}, undefined
                )

                if (node.server.matchQuery(query, device)) {
                    sendState();
                }
            }
        }

    }

    RED.nodes.registerType('deconz-input', deConzItemIn);
};


