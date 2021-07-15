const DeconzHelper = require('../lib/DeconzHelper.js');
const dotProp = require('dot-prop');
const ConfigMigration = require("../src/migration/ConfigMigration");
const OutputMsgFormatter = require("../src/runtime/OutputMsgFormatter");

module.exports = function (RED) {
    class deConzItemIn {
        constructor(config) {
            RED.nodes.createNode(this, config);

            let node = this;
            node.config = config;

            // Config migration
            let configMigration = new ConfigMigration('deconz-input', node.config);
            let migrationResult = configMigration.applyMigration(node.config, node);
            if (Array.isArray(migrationResult.errors) && migrationResult.errors.length > 0) {
                migrationResult.errors.forEach(error => console.error(error));
            }

            // Format : {'state':{__PATH__ : {"buttonevent": 1002}}}
            //node.oldValues = {'state': {}, 'config': {} /*, 'name': false*/};

            //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (node.server) {
                if (node.config.search_type === "device") {
                    node.config.device_list.forEach(function (item) {
                        node.server.registerNodeByDevicePath(node.config.id, item);
                    });
                } else {
                    node.server.registerNodeWithQuery(node.config.id);
                }

                // TODO handle send on start
                /*
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

                 */

            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/in:status.server_node_error"
                });
            }
        }


        handleDeconzEvent(device, changed, rawEvent) {
            let node = this;
            let msgs = new Array(this.config.output_rules.length);
            this.config.output_rules.forEach((rule, index) => {
                msgs.fill(undefined);
                let formatter = new OutputMsgFormatter(rule, this.config);

                let msgToSend = formatter.getMsgs({data: device, changed}, rawEvent);
                if (!Array.isArray(msgToSend)) msgToSend = [msgToSend];
                for (let msg of msgToSend) {
                    msg.topic = this.config.topic;
                    msgs[index] = msg;
                    node.send(msgs);
                }
            });
        }


        /*
        haveConnectedOutput(type) {
            let node = this;
            let index = {state: 0, homekit: 1, config: 2};
            if (!(type in index)) return false;
            if (!Array.isArray(node.config.wires)) return false;
            if (!Array.isArray(node.config.wires[index[type]])) return false;
            return node.config.wires[index[type]].length > 0;
        }


        getStatePayload(device) {
            let node = this;
            return (node.config.state in device.state) ? device.state[node.config.state] : device.state;
        }


        setStateCache(type, device_path, state, value) {
            let node = this;
            if (!(device_path in node.oldValues[type])) node.oldValues[type][device_path] = {};
            node.oldValues[type][device_path][state] = value;
        }

        getStateCache(type, device_path, state) {
            let node = this;
            if (!(device_path in node.oldValues[type])) return undefined;
            return node.oldValues[type][device_path][state];
        }

        checkAndUpdateCache(type, device_path, state, newValue) {
            let node = this;
            let prev = node.getStateCache(type, device_path, state)
            if (prev !== newValue) {
                node.setStateCache(type, device_path, state, newValue)
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
                    text: "node-red-contrib-deconz/server:status.not_reachable"
                });
            } else if (dotProp.has(device, 'config.reachable') && device.config.reachable === false) {
                node.status({
                    fill: "red",
                    shape: "ring",
                    text: "node-red-contrib-deconz/server:status.not_reachable"
                });
            } else {

                //TODO maybe check if it's an array first or change it in migration config
                let nodeState;
                // If only one state selected
                if (!(
                    node.config.state.includes('__complete__') || // O = Complete state payload
                    node.config.state.includes('__each__') || // 1 = Each state payload
                    node.config.state.length > 1)
                ) {
                    nodeState = dotProp.get(device, 'state.' + node.config.state[0]);
                }
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: nodeState !== undefined ? nodeState.toString() : "node-red-contrib-deconz/server:status.connected"
                });
            }
        }


        sendLastState() {
            let node = this;
            // Make sure server is ready
            if (!node.server.ready) return false;

            let devices = node.getDevices();
            if (devices.length > 0) {
                devices.forEach(function (device) {
                    node.sendState(
                        device,
                        device,
                        false,
                        node.config.outputAtStartup,
                        node.config.homekit_output_at_startup,
                        node.config.config_output_at_startup
                    )
                });
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/server:status.device_not_set"
                });
            }
        }

        sendTo(outputName, payload) {
            let node = this;
            switch (outputName) {
                case 'state':
                    return node.send([payload, undefined, undefined]);
                case 'homekit':
                    return node.send([undefined, payload, undefined]);
                case 'config':
                    return node.send([undefined, undefined, payload]);
            }
        }

        // TODO filter old button event resent, move it to lastbuttonevent / do nothing because this can be handled by setting updated
        sendState(
            device,
            raw_payload = undefined,
            force = false,
            sendState = true,
            sendHomekit = true,
            sendConfig = true
        ) {
            let node = this;

            //Make sure to send to something
            sendState = sendState && node.haveConnectedOutput('state');
            sendHomekit = sendHomekit && node.haveConnectedOutput('homekit');
            sendConfig = sendConfig && node.haveConnectedOutput('config');

            // If nothing to send return now
            if (sendState === false && sendHomekit === false && sendConfig === false) return;

            node.updateNodeStatus(device);

            // Add device path to meta
            let device_path = node.server.getPathByDevice(device);
            if (!('device_path' in device)) {
                device.device_path = device_path;
            }

            // Get what values have changed and update cache
            let changed = {};
            let domains = [];
            if (sendState && node.config.output !== 'always') {
                domains.push('state');
            }

            if (sendConfig && node.config.config_output !== 'always') {
                domains.push('config');
            }

            domains.forEach(function (key) {
                if (dotProp.has(device, key)) {
                    Object.keys(dotProp.get(device, key)).forEach(function (state_name) {
                        if (node.checkAndUpdateCache(key, device_path, state_name, dotProp.get(device, key + '.' + state_name))) {
                            if (!(key in changed)) changed[key] = [];
                            changed[key].push(state_name);
                        }
                    });
                }
            });

            // TODO filtrer avec la liste des états/config sélectionnés
            if (sendState && node.config.output === 'onupdate') {
                sendState = Array.isArray(changed['state']) && changed['state'].includes('lastupdated');
            }

            if (sendConfig && node.config.config_output === 'onupdate') {
                sendConfig = Array.isArray(changed['config']) && changed['config'].length > 0;
            }

            let baseMsg = {
                topic: node.config.topic,
                //payload: (node.config.state in device.state) ? device.state[node.config.state] : device.state,
                payload_raw: raw_payload || device,
                meta: device
            };

            let sendToOutputs = function (type) {
                return;
                // Still need to check if output is On change
                if (node.config[type].includes('__complete__')) {
                    // Complete payload
                    switch (node.config.output) {
                        case 'always':
                            node.sendTo(type, Object.assign({}, baseMsg, {
                                payload: device[type],
                                payload_domain: type,
                            }))
                            break;
                        case 'onchange':
                        case 'onupdate':
                            // The javascript methods in browser block that but in case ...
                            node.status({
                                fill: "red",
                                shape: "ring",
                                text: "node-red-contrib-deconz/server:status.complete_only_always"
                            });
                            break;
                    }
                } else if (node.config[type].includes('__each__') || node.config[type].length > 0) {
                    // Each payload or state list

                    // In case of name change ignore it
                    if (!(type in device)) return;

                    let states = [];

                    if (node.config[type].includes('__each__')) {
                        states = Object.keys(device[type])
                    } else if (node.config[type].length > 0) {
                        states = node.config[type]
                    }

                    states.forEach(function (state) {
                        switch (node.config.output) {
                            case 'always':
                            case 'onupdate':
                                node.sendTo(type, Object.assign({}, baseMsg, {
                                    payload: device[type][state],
                                    payload_domain: type,
                                    payload_type: state
                                }))
                                break;
                            case 'onchange':
                                if (Array.isArray(changed[type]) && changed[type].includes(state)) {
                                    node.sendTo(type, Object.assign({}, baseMsg, {
                                        payload: device[type][state],
                                        payload_domain: type,
                                        payload_type: state,
                                    }))
                                }
                                break;
                        }
                    });
                } else {
                    // Should never happen
                    console.warn(
                        "Error #9453 : This should not happen, please report on github: "
                        + "https://github.com/deconz-community/node-red-contrib-deconz/issues"
                    )
                }
            }

            if (sendState) sendToOutputs('state');
            if (sendHomekit) node.sendTo('homekit', node.formatHomeKit(device));
            if (sendConfig) sendToOutputs('config');

        };

        // TODO extract homekit formatter to a speratate file
        formatHomeKit(device, options) {
            let node = this;
            let state = device.state;
            let config = device.config;
            let deviceMeta = device;

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
                text: "node-red-contrib-deconz/server:status.reconnecting"
            });

            //send NO_RESPONSE
            node.getDevices().forEach(function (device) {
                node.send([
                    undefined,
                    node.formatHomeKit(device, {reachable: false}),
                    undefined
                ]);
            });
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
                text: "node-red-contrib-deconz/server:status.disconnected"
            });
        }

        onSocketOpen() {
            let node = this;
            // This will skip the first socket open, the first states are sent through onNewDevice event.
            if (node.server.ready) {
                node.sendLastState();
            }
        }

        onNewDevice(resource, object_index, initialDiscovery) {
            let node = this;
            let device = node.server.items[resource][object_index];

            let sendState = function () {
                if (initialDiscovery) {
                    // On node-red start
                    setTimeout(function () {
                        node.sendState(
                            device,
                            device,
                            true,
                            node.config.outputAtStartup,
                            node.config.homekit_output_at_startup,
                            node.config.config_output_at_startup
                        );
                    }, 1500); //we need this timeout after restart of node-red  (homekit delays)
                } else {
                    node.sendState(device, device);
                }
            }

            if (node.config.search_type === "device") {
                if (node.config.device_list.includes(resource + "/" + object_index)) {
                    sendState();
                }
            } else {
                try {
                    let query = RED.util.evaluateNodeProperty(
                        node.config.query,
                        node.config.search_type,
                        RED.nodes.getNode(node.config.id), // TODO Maybe I can use `node` directly
                        {}, undefined
                    )
                    if (node.server.matchQuery(query, device)) {
                        sendState();
                    }
                } catch (e) {
                    node.status({
                        fill: "red",
                        shape: "ring",
                        text: "node-red-contrib-deconz/server:status.query_error"
                    });
                }

            }
        }

        getDevices() {
            let node = this;
            let devices = [];

            switch (node.config.search_type) {
                case 'device':
                    node.config.device_list.forEach(function (path) {
                        devices.push(node.server.getDeviceByPath(path));
                    })
                    break;
                case 'json':
                case 'jsonata':
                    try {
                        let query = RED.util.evaluateNodeProperty(
                            node.config.query,
                            node.config.search_type,
                            RED.nodes.getNode(node.config.id), // TODO Maybe I can use `node` directly
                            {}, undefined
                        )
                        if (node.server.matchQuery(query, device)) {
                            devices.push(device)
                        }
                    } catch (e) {
                        node.status({fill: "red", shape: "ring", text: "Error, cant read query"});
                        return false;
                    }
                    break;
            }

            return devices;
        }
         */
    }

    RED.nodes.registerType('deconz-input', deConzItemIn);
};


