const got = require('got');

const dotProp = require('dot-prop');
const DeviceList = require('../src/runtime/DeviceList');
const DeconzAPI = require("../src/runtime/DeconzAPI");
const DeconzSocket = require("../src/runtime/DeconzSocket");
const ConfigMigration = require("../src/migration/ConfigMigration");
const Query = require('../src/runtime/Query');
const Utils = require("../src/runtime/Utils");

module.exports = function (RED) {
    class ServerNode {
        constructor(config) {
            RED.nodes.createNode(this, config);
            let node = this;
            node.config = config;
            node.discoverProcessRunning = false;
            node.ready = false;

            // Config migration
            let configMigration = new ConfigMigration('deconz-server', node.config, this);
            let migrationResult = configMigration.applyMigration(node.config, node);
            if (Array.isArray(migrationResult.errors) && migrationResult.errors.length > 0) {
                migrationResult.errors.forEach(
                    error => console.error(`Error with migration of node ${node.type} with id ${node.id}`, error)
                );
            }

            node.device_list = new DeviceList();
            node.api = new DeconzAPI({
                ip: node.config.ip,
                port: node.config.port,
                key: node.credentials.secured_apikey
            });

            // Example : ["ea9cd132.08f36"]
            node.nodesWithQuery = [];
            node.nodesEvent = [];
            node.nodesByDevicePath = {};

            node.setMaxListeners(255);
            node.refreshDiscoverTimer = null;
            node.refreshDiscoverInterval = node.config.polling >= 3 ? node.config.polling * 1000 : 15000;


            node.on('close', () => this.onClose());

            (async () => {
                //TODO make the delay configurable
                await Utils.sleep(1500);

                await node.discoverDevices({
                    forceRefresh: true
                });
                this.refreshDiscoverTimer = setInterval(() => {
                    node.discoverDevices({
                        forceRefresh: true
                    });
                }, node.refreshDiscoverInterval);

                node.ready = true;
                node.emit('onStart');

                this.setupDeconzSocket(node);

            })();
        }

        async waitForReady(maxDelay = 10000) {
            const pauseDelay = 100;
            let pauseCount = 0;
            while (this.ready === false) {
                await Utils.sleep(pauseDelay);
                pauseCount++;
                if (pauseCount * pauseDelay >= maxDelay) {
                    break;
                }
            }
        }

        setupDeconzSocket(node) {
            node.socket = new DeconzSocket({
                hostname: node.config.ip,
                port: node.config.ws_port,
                secure: node.config.secure || false
            });

            node.socket.on('close', (code, reason) => {
                if (reason) { // don't bother the user unless there's a reason
                    node.warn(`WebSocket disconnected: ${code} - ${reason}`);
                }
                if (node.ready) node.propagateErrorNews(code, reason);
            });
            node.socket.on('unauthorized', () => this.onSocketUnauthorized());
            node.socket.on('open', () => {
                node.log(`WebSocket opened`);
                // This is used only on websocket reconnect, not the initial connection.
                if (node.ready) node.propagateStartNews();
            });
            node.socket.on('message', (payload) => this.onSocketMessage(payload));
            node.socket.on('error', (err) => this.onSocketError(err));
            node.socket.on('pong-timeout', () => this.onSocketPongTimeout());
        }

        async discoverDevices(opt) {
            let node = this;
            let options = Object.assign({
                forceRefresh: false,
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
        }

        propagateStartNews() {
            let node = this;
            // Node with device selected
            for (let [device_path, nodeIDs] of Object.entries(node.nodesByDevicePath)) {
                node.propagateNews(nodeIDs, {
                    type: 'start',
                    node_type: 'device_path',
                    device: node.device_list.getDeviceByPath(device_path)
                });
            }

            // Node with quety
            for (let nodeID of node.nodesWithQuery) {
                let target = RED.nodes.getNode(nodeID);

                if (!target) {
                    console.warn('ERROR: cant get ' + nodeID + ' node for start news, removed from list NodeWithQuery');
                    node.unregisterNodeWithQuery(nodeID);
                    continue;
                }

                // TODO Cache JSONata expresssions ?
                let querySrc = RED.util.evaluateJSONataExpression(
                    RED.util.prepareJSONataExpression(target.config.query, target),
                    {},
                    undefined
                );
                let devices = node.device_list.getDevicesByQuery(querySrc);
                if (devices.matched.length === 0) continue;
                for (let device of devices.matched) {
                    node.propagateNews(nodeID, {
                        type: 'start',
                        node_type: 'query',
                        device: device,
                    });
                }
            }
        }

        propagateErrorNews(code, reason) {
            let node = this;

            // Node with device selected
            for (let [device_path, nodeIDs] of Object.entries(node.nodesByDevicePath)) {
                node.propagateNews(nodeIDs, {
                    type: 'error',
                    node_type: 'device_path',
                    device: node.device_list.getDeviceByPath(device_path),
                    errorCode: code,
                    errorMsg: `WebSocket disconnected: ${reason || 'no reason provided'}`
                });
            }

            // Node with quety
            for (let nodeID of node.nodesWithQuery) {
                let target = RED.nodes.getNode(nodeID);

                if (!target) {
                    console.warn('ERROR: cant get ' + nodeID + ' node for error news, removed from list NodeWithQuery');
                    node.unregisterNodeWithQuery(nodeID);
                    continue;
                }

                // TODO Cache JSONata expresssions ?
                let querySrc = RED.util.evaluateJSONataExpression(
                    RED.util.prepareJSONataExpression(target.config.query, target),
                    {},
                    undefined
                );
                let devices = node.device_list.getDevicesByQuery(querySrc);
                if (devices.matched.length === 0) continue;
                for (let device of devices.matched) {
                    node.propagateNews(nodeID, {
                        type: 'error',
                        node_type: 'query',
                        device: device,
                        errorCode: code,
                        errorMsg: `WebSocket disconnected: ${reason || 'no reason provided'}`
                    });
                }
            }
        }

        /**
         *
         * @param nodeIDs List of nodes [nodeID1, nodeID2]
         * @param news Object what kind of news need to be sent
         *     {type: 'start|event|error', eventData:{}, errorCode: "", errorMsg: "", device: {}, changed: {}}
         */
        propagateNews(nodeIDs, news) {
            //TODO add the event type in the msg
            let node = this;

            // Make sure that we have node to send the message to
            if (nodeIDs === undefined || Array.isArray(nodeIDs) && nodeIDs.length === 0) return;
            if (!Array.isArray(nodeIDs)) nodeIDs = [nodeIDs];

            for (const nodeID of nodeIDs) {
                let target = RED.nodes.getNode(nodeID);
                // If the target does not exist we remove it from the node list
                if (!target) {
                    switch (news.node_type) {
                        case 'device_path':
                            console.warn('ERROR: cant get ' + nodeID + ' node, removed from list nodesByDevicePath');
                            node.unregisterNodeByDevicePath(nodeID, news.device.device_path);
                            break;
                        case 'query':
                            console.warn('ERROR: cant get ' + nodeID + ' node, removed from list nodesWithQuery');
                            node.unregisterNodeWithQuery(nodeID);
                            break;
                        case 'event_node':
                            console.warn('ERROR: cant get ' + nodeID + ' node, removed from list nodesEvent');
                            node.unregisterEventNode(nodeID);
                            break;
                    }
                    return;
                }

                switch (news.type) {
                    case 'start':
                        switch (target.type) {
                            case 'deconz-input':
                            case 'deconz-battery':
                                target.handleDeconzEvent(
                                    news.device,
                                    [],
                                    news.device,
                                    {initialEvent: true}
                                );
                                break;
                        }

                        break;
                    case 'event':
                        let dataParsed = news.eventData;
                        switch (dataParsed.t) {
                            case "event":
                                if (target.type === "deconz-event") {
                                    target.handleDeconzEvent(
                                        news.device,
                                        news.changed,
                                        dataParsed
                                    );
                                } else {
                                    switch (dataParsed.e) {
                                        case "added":
                                        case "deleted":
                                            node.discoverDevices({
                                                forceRefresh: true
                                            }).then();
                                            break;
                                        case "changed":
                                            if (['deconz-input', 'deconz-battery'].includes(target.type)) {
                                                target.handleDeconzEvent(
                                                    news.device,
                                                    news.changed,
                                                    dataParsed
                                                );
                                            } else {
                                                console.warn("WTF this is used : We tried to send a msg to a non input node.");
                                                continue;
                                            }
                                            break;
                                        case "scene-called":
                                            // TODO Implement This
                                            console.warn("Need to implement onSocketMessageSceneCalled for " + JSON.stringify(dataParsed));
                                            break;
                                        default:
                                            console.warn("Unknown event of type '" + dataParsed.e + "'. " + JSON.stringify(dataParsed));
                                            break;
                                    }
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
                            case 'deconz-battery':
                                target.handleDeconzEvent(
                                    news.device,
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

        registerEventNode(nodeID) {
            let node = this;
            if (!node.nodesEvent.includes(nodeID)) node.nodesEvent.push(nodeID);
        }

        unregisterEventNode(nodeID) {
            let node = this;
            let index = node.nodesEvent.indexOf(nodeID);
            if (index !== -1) node.nodesEvent.splice(index, 1);
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
            let node = this;
            node.ready = false;
            node.log('WebSocket connection closed');
            node.emit('onClose');
            clearInterval(node.refreshDiscoverTimer);
            node.socket.close();
            node.socket = undefined;
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

        updateDevice(device, dataParsed) {
            let node = this;
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

        onSocketMessageSceneCalled(dataParsed) {
            console.warn("Need to implement onSocketMessageSceneCalled for " + JSON.stringify(dataParsed));
            // TODO implement
        }

        onSocketMessage(dataParsed) {
            let node = this;
            node.emit('onSocketMessage', dataParsed); //Used by event node, TODO Really used ?

            let device = node.device_list.getDeviceByDomainID(dataParsed.r, dataParsed.id);
            if (device === undefined) return;
            let changed = node.updateDevice(device, dataParsed);

            // Node with device selected
            node.propagateNews(node.nodesByDevicePath[device.device_path], {
                type: 'event',
                node_type: 'device_path',
                eventData: dataParsed,
                device: device,
                changed: changed
            });

            // Node with quety
            let matched = [];
            for (let nodeID of node.nodesWithQuery) {
                let target = RED.nodes.getNode(nodeID);

                if (!target) {
                    console.warn('ERROR: cant get ' + nodeID + ' node for socket message news, removed from list NodeWithQuery');
                    node.unregisterNodeWithQuery(nodeID);
                    continue;
                }

                // TODO Cache JSONata expresssions ?
                let querySrc = RED.util.evaluateJSONataExpression(
                    RED.util.prepareJSONataExpression(target.config.query, target),
                    {},
                    undefined
                );
                let query = new Query(querySrc);
                if (query.match(device)) {
                    matched.push(nodeID);
                }
            }

            if (matched.length > 0) node.propagateNews(matched, {
                type: 'event',
                node_type: 'query',
                eventData: dataParsed,
                device: device,
                changed: changed
            });

            // Event Nodes
            node.propagateNews(node.nodesEvent, {
                type: 'event',
                node_type: 'event_node',
                eventData: dataParsed,
                device: device,
                changed: changed
            });

        }

    }

    RED.nodes.registerType('deconz-server', ServerNode, {
        credentials: {
            secured_apikey: {type: "text"}
        }
    });
};

