const got = require('got');

const dotProp = require('dot-prop');
const DeviceList = require('../src/runtime/DeviceList');
const DeconzAPI = require("../src/runtime/DeconzAPI");
const DeconzSocket = require("../src/runtime/DeconzSocket");
const ConfigMigration = require("../src/migration/ConfigMigration");

module.exports = function (RED) {
    class ServerNode {
        constructor(config) {
            RED.nodes.createNode(this, config);
            let node = this;
            node.config = config;
            node.discoverProcessRunning = false;
            node.ready = false;

            // Config migration
            let configMigration = new ConfigMigration('deconz-server', node.config);
            let migrationResult = configMigration.applyMigration(node.config, node);
            if (Array.isArray(migrationResult.errors) && migrationResult.errors.length > 0) {
                migrationResult.errors.forEach(error => console.error(error));
            }

            node.device_list = new DeviceList();
            node.api = new DeconzAPI({
                ip: node.config.ip,
                port: node.config.port,
                key: node.credentials.secured_apikey
            });

            // Example : ["ea9cd132.08f36"]
            node.nodesWithQuery = [];
            node.nodesByDevicePath = {};

            node.setMaxListeners(255);
            node.refreshDiscoverTimer = null;
            node.refreshDiscoverInterval = node.config.polling >= 3 ? node.config.polling * 1000 : 15000;

            node.socket = new DeconzSocket({
                hostname: node.config.ip,
                port: node.config.ws_port,
                secure: node.config.secure || false
            });


            node.socket.on('close', (code, reason) => {
                // TODO This is sent on deploy too, this should not be the case. (but not every time lol)
                if (reason) { // don't bother the user unless there's a reason
                    node.warn(`WebSocket disconnected: ${code} - ${reason}`);
                }
                node.propagateNews(node.nodesByDevicePath, {
                    type: 'error',
                    errorCode: code,
                    errorMsg: `WebSocket disconnected: ${reason || 'no reason provided'}`
                });
            });

            node.socket.on('unauthorized', () => this.onSocketUnauthorized());
            node.socket.on('open', () => {
                node.log(`WebSocket opened`);
                if (node.ready) node.propagateNews(node.nodesByDevicePath, {
                    type: 'start',
                });

            });
            node.socket.on('message', (payload) => this.onSocketMessage(payload));
            node.socket.on('error', (err) => this.onSocketError(err));
            node.socket.on('pong-timeout', () => this.onSocketPongTimeout());

            node.on('close', () => this.onClose());

            (async () => {
                await node.discoverDevices({
                    forceRefresh: true,
                    initialDiscovery: true
                });
                this.refreshDiscoverTimer = setInterval(() => {
                    node.discoverDevices({
                        forceRefresh: true
                    });
                }, node.refreshDiscoverInterval);
            })();
        }

        async discoverDevices(opt) {
            let node = this;
            let options = Object.assign({
                forceRefresh: false,
                initialDiscovery: false,
                callback: () => {
                }
            }, opt);

            if (options.forceRefresh === false || node.discoverProcessRunning === true) {
                node.log('discoverDevices: Using cached devices');
                return;
            }

            node.discoverProcessRunning = true;
            const response = await got(node.api.url.main()).json();
            node.device_list.parse(response);
            node.log(`discoverDevices: Updated ${node.device_list.count}`);
            node.discoverProcessRunning = false;

            if (options.initialDiscovery === true) {
                //TODO add delay ?
                node.propagateNews(node.nodesByDevicePath, {type: 'start'});
            }

        }

        /**
         *
         * @param targets List of nodes {device_path : [nodeIDs]}
         * @param news Object what kind of news need to be sent
         *     {type: 'start|event|error', eventData:{}, errorCode: "", errorMsg: ""}
         */
        propagateNews(targets, news) {
            let node = this;
            node.ready = true;
            for (const [path, nodeIDs] of Object.entries(targets)) {
                for (const nodeID of nodeIDs) {
                    let target = RED.nodes.getNode(nodeID);
                    // If the target does not exist we remove it from the node list
                    if (!target) {
                        console.warn('ERROR: cant get ' + nodeID + ' node, removed from list nodesByDevicePath');
                        node.unregisterNodeByDevicePath(nodeID, path);
                        return;
                    }
                    let device = node.device_list.getDeviceByPath(path);
                    switch (news.type) {
                        case 'start':
                            switch (target.type) {
                                case 'deconz-input':
                                    target.handleDeconzEvent(
                                        device,
                                        [],
                                        {},
                                        {initialEvent: true}
                                    );
                                    break;

                                //TODO Implement other node types
                            }

                            break;
                        case 'event':
                            let dataParsed = news.eventData;
                            switch (dataParsed.t) {
                                case "event":
                                    switch (dataParsed.e) {
                                        case "added":
                                        case "deleted":
                                            node.discoverDevices({
                                                forceRefresh: true
                                            }).then();
                                            break;
                                        case "changed":
                                            node.onSocketMessageChanged(dataParsed);
                                            break;
                                        case "scene-called":
                                            node.onSocketMessageSceneCalled(dataParsed);
                                            break;
                                        default:
                                            console.warn("Unknown event of type '" + dataParsed.e + "'. " + JSON.stringify(dataParsed));
                                            break;
                                    }
                                    break;
                                default:
                                    console.warn("Unknown message of type '" + dataParsed.t + "'. " + JSON.stringify(dataParsed));
                                    break;
                            }

                            break;
                        case 'error':
                            switch (target.type) {
                                case 'deconz-input':
                                    target.handleDeconzEvent(
                                        device,
                                        [],
                                        {},
                                        {
                                            errorEvent: true,
                                            errorCode: news.errorCode || "Unknown Error",
                                            errorMsg: news.errorMsg || "Unknown Error"
                                        }
                                    );
                                    break;

                                //TODO Implement other node types
                            }
                            break;
                    }

                }

            }


        }

        registerNodeByDevicePath(nodeID, device_path) {
            let node = this;
            if (!(device_path in node.nodesByDevicePath)) node.nodesByDevicePath[device_path] = [];
            if (!node.nodesByDevicePath[device_path].includes(nodeID)) node.nodesByDevicePath[device_path].push(nodeID);
        }

        unregisterNodeByDevicePath(nodeID, device_path) {
            let node = this;
            let index = node.nodesByDevicePath[device_path].indexOf(nodeID);
            if (index !== -1) node.nodesByDevicePath[device_path].splice(index, 1);
        }

        registerNodeWithQuery(nodeID) {
            let node = this;
            if (!node.nodesWithQuery.includes(nodeID)) node.nodesWithQuery.push(nodeID);
        }

        unregisterNodeWithQuery(nodeID) {
            let node = this;
            let index = node.nodesWithQuery.indexOf(nodeID);
            if (index !== -1) node.nodesWithQuery.splice(index, 1);
        }

        onClose() {
            let that = this;
            that.log('WebSocket connection closed');
            that.emit('onClose');

            clearInterval(that.refreshDiscoverTimer);
            that.socket.close();
            that.socket = undefined;
        }

        onSocketPongTimeout() {
            let that = this;
            that.warn('WebSocket connection timeout, reconnecting');
            that.emit('onSocketPongTimeout');
        }

        onSocketUnauthorized() {
            let that = this;
            that.warn('WebSocket authentication failed');
            that.emit('onSocketUnauthorized');
        }

        onSocketError(err) {
            let that = this;
            that.warn(`WebSocket error: ${err}`);
            that.emit('onSocketError');
        }

        onSocketClose(code, reason) {
            let that = this;
            if (reason) { // don't bother the user unless there's a reason
                that.warn(`WebSocket disconnected: ${code} - ${reason}`);
            }
            that.emit('onSocketClose');
        }

        onSocketOpen(err) {
            let that = this;
            that.log(`WebSocket opened`);
            that.emit('onSocketOpen');
        }

        updateDevice(device_path, dataParsed) {
            let node = this;
            let device = node.device_list.getDeviceByPath(device_path);
            let changed = [];

            if (dotProp.has(dataParsed, 'name')) {
                device.name = dotProp.get(dataParsed, 'name');
                changed.push('name');
            }

            ['config', 'state'].forEach(function (key) {
                if (dotProp.has(dataParsed, key)) {
                    Object.keys(dotProp.get(dataParsed, key)).forEach(function (state_name) {
                        let valuePath = key + '.' + state_name;
                        let newValue = dotProp.get(dataParsed, valuePath);
                        let oldValue = dotProp.get(device, valuePath);
                        if (newValue !== oldValue) {
                            changed.push(`${key}.${state_name}`);
                            dotProp.set(device, valuePath, newValue);
                        }
                    });
                }
            });
            return changed;
        }

        onSocketMessageChanged(dataParsed) {
            let that = this;

            let paths = {};
            // Path by unique ID
            if (dataParsed.uniqueid !== undefined) {
                paths.uniqueid = that.device_list.getPathByDevice({
                    device_type: dataParsed.r,
                    uniqueid: dataParsed.uniqueid
                });
            }
            // Path by device ID
            if (dataParsed.id !== undefined) {
                paths.device_id = that.device_list.getPathByDevice({
                    device_type: dataParsed.r,
                    device_id: dataParsed.id
                });
            }

            let changed = that.updateDevice(paths.uniqueid || paths.device_id, dataParsed);

            let visited = [];

            // TODO migrate that to propagateNews method
            for (const path of Object.values(paths)) {
                // Handle nodesByDevicePath
                if (that.nodesByDevicePath[path] !== undefined && that.nodesByDevicePath[path].length > 0) {
                    for (const nodeID of that.nodesByDevicePath[path]) {
                        // Make sure we don't send event twice TODO Used ?
                        if (visited.includes(nodeID)) {
                            console.warn("WTF this is used : Make sure we don't send event twice");
                            continue;
                        }
                        visited.push(nodeID);

                        let node = RED.nodes.getNode(nodeID);
                        if (!node) {
                            console.warn('ERROR: cant get ' + nodeID + ' node, removed from list nodesByDevicePath');
                            that.unregisterNodeByDevicePath(nodeID, path);
                            return;
                        }

                        let device = that.device_list.getDeviceByPath(path);
                        if (node.type === "deconz-input") {
                            node.handleDeconzEvent(
                                device,
                                changed,
                                dataParsed
                            );
                        }
                        //TODO Battery node
                    }

                }

                /*
                // TODO Handle nodesWithQuery
                that.nodesWithQuery.forEach(function (nodeID) {
                    let node = RED.nodes.getNode(nodeID);
                    if (!node) {
                        console.warn('ERROR: cant get ' + nodeID + ' node, removed from list nodesWithQuery');
                        that.unregisterNodeWithQuery(nodeID);
                        return;
                    }
                    let device = that.device_list.getDeviceByPath(path);
                    if (node.type === "deconz-input") {
                        try {
                            let query = RED.util.evaluateNodeProperty(
                                node.config.query,
                                node.config.search_type,
                                node,
                                {}, undefined
                            );
                            if (node.server.matchQuery(query, device)) {
                                node.sendState(
                                    device,
                                    dataParsed,
                                    false,
                                    'state' in dataParsed,
                                    'state' in dataParsed,
                                    'config' in dataParsed || 'name' in dataParsed
                                );
                            }
                        } catch (e) {
                            node.status({fill: "red", shape: "ring", text: "Error, cant read query"});
                        }
                    }
                });

                 */
            }


        }

        onSocketMessageSceneCalled(dataParsed) {
            console.warn("Need to implement onSocketMessageSceneCalled for " + JSON.stringify(dataParsed));
            // TODO implement
        }

        onSocketMessage(dataParsed) {
            let node = this;
            node.emit('onSocketMessage', dataParsed); //Used by event node, TODO Really used ?
            node.propagateNews(node.nodesByDevicePath, {
                type: 'event',
                eventData: dataParsed
            });
        }
    }

    RED.nodes.registerType('deconz-server', ServerNode, {
        credentials: {
            secured_apikey: {type: "text"}
        }
    });
};

