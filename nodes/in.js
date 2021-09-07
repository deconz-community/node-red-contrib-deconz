const DeconzHelper = require('../lib/DeconzHelper.js');
const dotProp = require('dot-prop');
const ConfigMigration = require("../src/migration/ConfigMigration");
const OutputMsgFormatter = require("../src/runtime/OutputMsgFormatter");

const NodeType = 'deconz-input';
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
            if (!node.server) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/in:status.server_node_error"
                });
                return;
            }

            if (node.config.search_type === "device") {
                node.config.device_list.forEach(function (item) {
                    node.server.registerNodeByDevicePath(node.config.id, item);
                });
            } else {
                node.server.registerNodeWithQuery(node.config.id);
            }

            node.status({
                fill: "blue",
                shape: "dot",
                text: "node-red-contrib-deconz/in:status.starting"
            });

            node.server.on('onStart', () => {
                // Display usefull info
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: "node-red-contrib-deconz/server:status.connected"
                });

                console.log('OnStart');
            });
            /*
            node.server.on('onClose', () => this.onClose());
            node.server.on('onSocketError', () => this.onSocketError());
            node.server.on('onSocketClose', () => this.onSocketClose());
            node.server.on('onSocketOpen', () => this.onSocketOpen());
            node.server.on('onSocketPongTimeout', () => this.onSocketPongTimeout());
            node.server.on('onNewDevice', (resource, object_index, init) => this.onNewDevice(resource, object_index, init));

             */

        }


        handleDeconzEvent(device, changed, rawEvent, opt) {
            let node = this;
            let msgs = new Array(this.config.output_rules.length);
            let options = Object.assign({
                initialEvent: false,
                errorEvent: false
            }, opt);
            this.config.output_rules.forEach((rule, index) => {
                // Only if it's not on start and the start msg are blocked
                if (!(options.initialEvent === true && rule.onstart !== true)) {
                    // Clean up old msgs
                    msgs.fill(undefined);

                    // Format msgs, can get one or many msgs.
                    let formatter = new OutputMsgFormatter(rule, NodeType, this.config);
                    let msgToSend = formatter.getMsgs({data: device, changed}, rawEvent, options);

                    // Make sure that the result is an array
                    if (!Array.isArray(msgToSend)) msgToSend = [msgToSend];

                    // Send msgs
                    for (let msg of msgToSend) {
                        msg.topic = this.config.topic;
                        msgs[index] = msg;
                        node.send(msgs);
                    }
                }

                //TODO display msg payload if it's possible (one rule and payload a non object value
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: "node-red-contrib-deconz/server:status.connected"
                });


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

    RED.nodes.registerType(NodeType, deConzItemIn);
};


