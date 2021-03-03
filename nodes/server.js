const request = require('request');
const DeconzSocket = require('../lib/deconz-socket');
const dotProp = require('dot-prop');
const compareVersions = require('compare-versions');


module.exports = function (RED) {
    class ServerNode {
        constructor(n) {
            RED.nodes.createNode(this, n);

            let node = this;
            node.resources = ['groups', 'lights', 'sensors'];
            node.items = undefined;
            node.discoverProcess = false;
            node.name = n.name;
            node.ip = n.ip;
            node.port = n.port;
            node.ws_port = n.ws_port;
            node.secure = n.secure || false;

            // Prior 1.2.0 the apikey was not stored in credentials
            if (node.credentials.secured_apikey === undefined && n.apikey !== undefined) {
                node.credentials.secured_apikey = n.apikey;
            }

            node.devices = {}; // TODO remove that Example : {"ea9cd132.08f36" : "68:0a:e2:ff:fe:32:2e:54-01-1000"}
            // Example : {"sensors/uniqueid/68:0a:e2:ff:fe:32:2e:54-01-1000":[ea9cd132.08f36]}
            node.nodesByDevicePath = {};
            // Example : ["ea9cd132.08f36"]
            node.nodesWithQuery = [];

            node.setMaxListeners(255);
            node.refreshDiscoverTimer = null;
            node.refreshDiscoverInterval = n.polling >= 3 ? n.polling * 1000 : 15000;

            node.socket = new DeconzSocket({
                hostname: this.ip,
                port: this.ws_port,
                secure: this.secure
            });

            node.socket.on('close', (code, reason) => this.onSocketClose(code, reason));
            node.socket.on('unauthorized', () => this.onSocketUnauthorized());
            node.socket.on('open', () => this.onSocketOpen());
            node.socket.on('message', (payload) => this.onSocketMessage(payload));
            node.socket.on('error', (err) => this.onSocketError(err));
            node.socket.on('pong-timeout', () => this.onSocketPongTimeout());

            node.on('close', () => this.onClose());

            node.discoverDevices(undefined, true, true);

            this.refreshDiscoverTimer = setInterval(function () {
                node.discoverDevices(undefined, true);
            }, node.refreshDiscoverInterval);
        }

        registerNodeByDevicePath(nodeID, device_path) {
            let node = this;
            if (!(device_path in node.nodesByDevicePath)) node.nodesByDevicePath[device_path] = []
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


        getAPIUrl() {
            let node = this;
            return "http://" + node.ip + ":" + node.port + "/api/" + node.credentials.secured_apikey;
        }

        discoverDevices(callback, forceRefresh = false, initialDiscovery = false) {
            let node = this;

            if (!(forceRefresh || node.items === undefined)) {
                node.log('discoverDevices: Using cached devices');
                if (callback !== undefined) {
                    callback(node.items);
                }
                return node.items;
            }

            node.discoverProcess = true;

            request.get(node.getAPIUrl(), function (error, result, data) {

                if (error) {
                    node.discoverProcess = false;
                    if (callback !== undefined) {
                        console.warn("Ended with errors on API request discoverDevices");
                        callback(false);
                    }
                    return;
                }

                let dataParsed;

                try {
                    dataParsed = JSON.parse(data);
                } catch (e) {
                    node.discoverProcess = false;
                    if (callback !== undefined) {
                        console.warn("Ended with errors on decoding json discoverDevices");
                        callback(false);
                    }
                    return;
                }

                node.oldItemsList = node.items /*!== undefined ? node.items : undefined*/ /* I don't understand the check here */;
                node.items = {};
                if (dataParsed) {

                    node.resources.forEach(function (resource) {
                        node.items[resource] = {};

                        Object.keys(dataParsed[resource]).forEach(function (key) {

                            let data = dataParsed[resource][key]

                            data.device_type = resource;
                            data.device_id = parseInt(key);
                            let device_path = node.getPathByDevice(data, false)

                            if (!(node.oldItemsList !== undefined && device_path in node.oldItemsList[resource])) {
                                node.items[resource][device_path] = data;
                                // TODO handle the new signature for onNewDevice
                                node.emit("onNewDevice", resource, device_path, initialDiscovery);
                            }

                            node.items[resource][device_path] = data;

                        })

                    });

                }

                node.discoverProcess = false;

                if (callback !== undefined) {
                    callback(node.items);
                }
                return node.items;
            });


        }

        getDiscoverProcess() {
            let node = this;
            return node.discoverProcess;
        }

        getDevice(uniqueid) {
            let node = this;
            let result = false;
            if (node.items !== undefined && node.items) {
                for (let index in (node.items)) {
                    if (node.items.hasOwnProperty(index)) {
                        let item = (node.items)[index];
                        if (index === uniqueid) {
                            result = item;
                            break;
                        }
                    }

                }
            }
            return result;
        }

        formatPath(type, uniqueID, id, includeDeviceType = true) {
            let ref = "";
            if (includeDeviceType) ref += type + "/"

            if (type === "groups") {
                ref += "device_id/" + id
            } else {
                if (uniqueID !== undefined) {
                    ref += "uniqueid/" + uniqueID
                } else {
                    ref += "device_id/" + id
                    console.warn("I found a device without uniqueID. His path is " + ref)
                }
            }
            return ref;
        }

        getPathByDevice(device, includeDeviceType = true) {
            let node = this;
            return node.formatPath(device.device_type, device.uniqueid, device.device_id, includeDeviceType)
        }

        getDeviceByPath(path) {
            let node = this;
            let result = false;
            let parts = path.split("/")
            let device_type = parts.shift()
            let sub_path = parts.join("/")
            if (node.items !== undefined && node.items && node.items[device_type] && node.items[device_type][sub_path]) {
                return node.items[device_type][sub_path];
            }
            return result;
        }

        getQuery(meta) {
            let query = {
                device_type: meta.device_type,
                limit: 1
            };

            if (meta.uniqueid !== undefined) {
                query.uniqueid = meta.uniqueid
            } else {
                query.device_id = meta.device_id
                if (meta.device_type !== "groups") {
                    query.unsafe = true;
                }
            }

            return query
        }


        matchSubQuery(meta, conditions, operator, depth = 1) {
            let node = this

            let matchMethod = function (value) {
                let target = dotProp.get(meta, value);

                if (target === undefined) return false;

                switch (typeof conditions[value]) {
                    case "undefined":
                        break;
                    case "function":
                        break;
                    case "symbol":
                        break;
                    case "bigint":
                        break;
                    case "boolean":
                    case "number":
                    case "string":
                        return conditions[value] === target;
                    case "object":
                        if (Array.isArray(conditions[value])) {
                            return conditions[value].some(target)
                        } else {
                            switch (conditions[value].type) {
                                case "compare":
                                    let left = target;
                                    let right = conditions[value].value
                                    let operator = conditions[value].operator

                                    switch (conditions[value].convertTo) {
                                        case "boolean":
                                            left = Boolean(left)
                                            break;
                                        case "number":
                                            left = Number(left)
                                            break;
                                        case "bigint":
                                            left = BigInt(left)
                                            break;
                                        case "string":
                                            left = left.toString()
                                            break;
                                        case "date":
                                            left = Date.parse(left)
                                            right = Date.parse(right)
                                            break;
                                        case "version":
                                            let versionOperator = operator;
                                            switch (versionOperator) {
                                                case "===":
                                                case "==":
                                                    versionOperator = "=";
                                                    break;
                                                case "!==":
                                                case "!=":
                                                    return left !== right;
                                            }
                                            return compareVersions.compare(left, right, versionOperator)
                                    }

                                    switch (operator) {
                                        case '===':
                                            return left === right;
                                        case '!==':
                                            return left !== right;
                                        case '==':
                                            return left == right;
                                        case '!=':
                                            return left != right;
                                        case '>':
                                            return left > right;
                                        case '>=':
                                            return left >= right;
                                        case '<':
                                            return left < right;
                                        case '<=':
                                            return left <= right;
                                        default :
                                            return false;
                                    }
                                case "sub_match":
                                    return node.matchSubQuery(
                                        meta,
                                        conditions[value].conditions,
                                        conditions[value].operator,
                                        depth + 1
                                    );
                                case "date":
                                    let tDate = Date.parse(target);
                                    if (conditions[value].before) {
                                        let before = Date.parse(conditions[value].before);
                                        if (typeof before !== "number" || tDate >= before) return false;
                                    }

                                    if (conditions[value].after) {
                                        let after = Date.parse(conditions[value].after);
                                        if (typeof after !== "number" || tDate <= after) return false;
                                    }
                                    return !(!conditions[value].before && !conditions[value].after);

                                case "regex":
                                    return (new RegExp(conditions[value].regex, conditions[value].flag))
                                        .test(String(target));
                                default:
                                    console.error("Unknown match type : " + conditions[value].type);
                                    return false;
                            }
                        }
                    default:
                        console.error("Unknown data type : " + typeof conditions[value])
                        return false;
                }
            }

            return (operator === "OR")
                ? Object.keys(conditions).some(matchMethod)
                : Object.keys(conditions).every(matchMethod)
        }


        matchQuery(query, meta) {
            if (Object.keys(query).lenth === 0) {
                return false;
            }

            // Direct match
            if (!['device_type', 'uniqueid', 'device_id'].every((value) => {
                return query[value] === undefined ? true : query[value] === meta[value];
            })) {
                return false;
            }

            // Query match
            if (query.match !== undefined) {
                return this.matchSubQuery(meta, query.match, query.match_method)
            }

            return true;
        }

        getItemsList(callback, query, forceRefresh = false) {
            let node = this;
            node.discoverDevices(function (devices) {
                let items_list = [];
                if (devices) {
                    Object.keys(devices).forEach(function (resource) {
                        // Filter on query.device_type to optimise ? Worth it ?
                        Object.keys(devices[resource]).forEach(function (uniqueid) {
                            let device = devices[resource][uniqueid]

                            let result = {
                                device_name: device.name + ' : ' + device.type,
                                resource: resource,
                                uniqueid: device.uniqueid,
                                meta: device,
                                query: node.getQuery(device),
                                path: node.getPathByDevice(device),
                                query_match: false
                            };


                            // Todo Handle limit
                            if (query === undefined || node.matchQuery(query, device)) {
                                result.query_match = true;
                            }

                            items_list.push(result);

                        });
                    });
                }
                callback(items_list);
                return items_list;
            }, forceRefresh);
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

        onSocketMessage(dataParsed) {
            let that = this;
            that.emit('onSocketMessage', dataParsed); //Used by event node

            //TODO handle scenes changes
            if (dataParsed.r === "scenes") return;

            let path = that.formatPath(dataParsed.r, dataParsed.uniqueid, dataParsed.id)

            // Handle nodesByDevicePath
            if (that.nodesByDevicePath[path] !== undefined && that.nodesByDevicePath[path].length > 0) {
                that.nodesByDevicePath[path].forEach(function (nodeID) {
                    //let node = RED.nodes.getNode(nodeID);
                    let node = RED.nodes.getNode(nodeID);
                    if (!node) {
                        console.warn('ERROR: cant get ' + nodeID + ' node, removed from list nodesByDevicePath');
                        that.unregisterNodeByDevicePath(nodeID, path);
                        return;
                    }
                    let device = that.getDeviceByPath(path);
                    if (node.type === "deconz-input") {
                        node.sendState(device, false, true, true, dataParsed);
                    }
                })
            }

            // Handle nodesWithQuery
            that.nodesWithQuery.forEach(function (nodeID) {
                let node = RED.nodes.getNode(nodeID);
                if (!node) {
                    console.warn('ERROR: cant get ' + nodeID + ' node, removed from list nodesWithQuery');
                    that.unregisterNodeWithQuery(nodeID);
                    return;
                }
                let device = that.getDeviceByPath(path);
                if (node.type === "deconz-input") {
                    let query = RED.util.evaluateNodeProperty(
                        node.config.query,
                        node.config.search_type,
                        node,
                        {}, undefined
                    )
                    if (node.server.matchQuery(query, device)) {
                        node.sendState(device, false, true, true, dataParsed);
                    }
                }
            })
        }
    }

    RED.nodes.registerType('deconz-server', ServerNode, {
        credentials: {
            secured_apikey: {type: "text"}
        }
    });
};

