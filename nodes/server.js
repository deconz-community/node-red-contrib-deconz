const request = require('request');
const DeconzSocket = require('../lib/deconz-socket');
const dotProp = require('dot-prop');
const compareVersions = require('compare-versions');

/**
 * @typedef {Object} Query
 * @template Match
 * @property {String|undefined} device_type - the device type, can be 'groups', 'lights', 'sensors'.
 * @property {Number|undefined} device_id - the device id.
 * @property {String|undefined} uniqueid - the device uniqueid.
 */

/**
 * @typedef {Object} Match
 * @property {String} type - the device type, need to be 'match'.
 * @property {String|undefined} operator - the device type, can be 'AND', 'OR', 'undefined'.
 * @property {String|Object.<String,String|Number|Boolean|Match|DateMatch|CompareMatch|RegexMatch>} match - list of key - values to check.
 */

/**
 * @typedef {Object} DateMatch
 * @property {String} type - the match type, need to be 'date'.
 * @property {String} after - any value supported by Date.parse.
 * @property {String} before - any value supported by Date.parse.
 */

/**
 * @typedef {Object} CompareMatch
 * @property {String} type - the match type, need to be 'compare'.
 * @property {String} convertTo - can be 'boolean', 'number', 'bigint', 'float', 'string', 'date', 'version'.
 * @property {Boolean|undefined} convertLeft - Convert device value. Default : true.
 * @property {Boolean|undefined} convertRight - Convert query value. Default : true.
 * @property {String} operator - can be '===', '!==', '==', '!=', '>', '>=', '<', '<='.
 * @property {String|Number|Boolean} value - a value to compare to.
 */

/**
 * @typedef {Object} RegexMatch
 * @property {String} type - the match type, need to be 'regex'.
 * @property {String} regex - any value accepted by RegExp constructor as first argument.
 * @property {String|undefinded} flag - any value accepted by RegExp constructor as second argument. By default 'g'
 */


module.exports = function (RED) {
    class ServerNode {
        constructor(n) {
            RED.nodes.createNode(this, n);

            let node = this;
            node.resources = ['groups', 'lights', 'sensors'];
            node.items = undefined;
            node.discoverProcess = false;
            node.ready = false;
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

            let updateReady = function (result) {
                node.ready = result !== false;
            };

            node.discoverDevices(updateReady, true, true);

            this.refreshDiscoverTimer = setInterval(function () {
                node.discoverDevices(updateReady, true);
            }, node.refreshDiscoverInterval);
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


        getAPIUrl() {
            let node = this;
            return "http://" + node.ip + ":" + node.port + "/api/" + node.credentials.secured_apikey;
        }

        discoverDevices(callback, forceRefresh = false, initialDiscovery = false) {
            let node = this;

            if (!(forceRefresh || node.items === undefined) || node.getDiscoverProcess()) {
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

                            let data = dataParsed[resource][key];

                            data.device_type = resource;
                            data.device_id = parseInt(key);
                            let device_path = node.getPathByDevice(data, false);

                            if (!(node.oldItemsList !== undefined && device_path in node.oldItemsList[resource])) {
                                node.items[resource][device_path] = data;
                                // TODO handle the new signature for onNewDevice
                                node.emit("onNewDevice", resource, device_path, initialDiscovery);
                            }

                            node.items[resource][device_path] = data;

                        });

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
            if (node.items === undefined) {
                return;
            }

            for (const domain of Object.values(node.items)) {
                for (const device of Object.values(domain)) {
                    if (device.uniqueid === uniqueid) return device;
                }
            }
        }

        formatPath(type, uniqueID, id, includeDeviceType = true) {
            let ref = "";
            if (includeDeviceType) ref += type + "/";

            if (type === "groups") {
                ref += "device_id/" + id;
            } else {
                if (uniqueID !== undefined) {
                    ref += "uniqueid/" + uniqueID;
                } else {
                    ref += "device_id/" + id;
                    console.warn("I found a device without uniqueID. His path is " + ref);
                }
            }
            return ref;
        }

        getPathByDevice(device, includeDeviceType = true) {
            let node = this;
            return node.formatPath(device.device_type, device.uniqueid, device.device_id, includeDeviceType);
        }

        getDeviceByPath(path) {
            let node = this;
            let result = false;
            let parts = path.split("/");
            let device_type = parts.shift();
            let sub_path = parts.join("/");
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
                query.uniqueid = meta.uniqueid;
            } else {
                query.device_id = meta.device_id;
                if (meta.device_type !== "groups") {
                    query.unsafe = true;
                }
            }

            return query;
        }


        matchSubQuery(meta, conditions, operator, depth = 1) {
            let node = this;

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
                            if (typeof target === 'function')
                                return conditions[value].some(target);
                            else
                                return conditions[value].includes(target);
                        } else {
                            switch (conditions[value].type) {
                                case "compare":
                                    let left = target;
                                    let right = conditions[value].value;
                                    let operator = conditions[value].operator;

                                    switch (conditions[value].convertTo) {
                                        case "boolean":
                                            left = Boolean(left);
                                            break;
                                        case "number":
                                            left = Number(left);
                                            break;
                                        case "bigint":
                                            left = BigInt(left);
                                            break;
                                        case "string":
                                            left = left.toString();
                                            break;
                                        case "date":
                                            left = Date.parse(left);
                                            right = Date.parse(right);
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
                                            return compareVersions.compare(left, right, versionOperator);
                                    }

                                    switch (operator) {
                                        case '===':
                                            return left === right;
                                        case '!==':
                                            return left !== right;
                                        case '==':
                                            // noinspection EqualityComparisonWithCoercionJS
                                            return left == right;
                                        case '!=':
                                            // noinspection EqualityComparisonWithCoercionJS
                                            return left != right;
                                        case '>':
                                            return left > right;
                                        case '>=':
                                            return left >= right;
                                        case '<':
                                            return left < right;
                                        case '<=':
                                            return left <= right;
                                    }
                                    return false;
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
                            }
                        }
                        console.error("Unknown match type : " + conditions[value].type);
                        return false;
                    default:
                        console.error("Unknown data type : " + typeof conditions[value]);
                        return false;
                }
            };

            return (operator === "OR") ?
                Object.keys(conditions).some(matchMethod)
                : Object.keys(conditions).every(matchMethod);
        }


        matchQuery(query, meta) {
            if (Object.keys(query).length === 0) {
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
                return this.matchSubQuery(meta, query.match, query.match_method);
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
                            let device = devices[resource][uniqueid];

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

        updateDevice(device_path, dataParsed) {
            let node = this;
            let device = node.getDeviceByPath(device_path);
            let changed = {};

            if (dotProp.has(dataParsed, 'name')) {
                device.name = dotProp.get(dataParsed, 'name');
                changed.name = true;
            }

            ['config', 'state'].forEach(function (key) {
                if (dotProp.has(dataParsed, key)) {
                    Object.keys(dotProp.get(dataParsed, key)).forEach(function (state_name) {
                        let valuePath = key + '.' + state_name;
                        let newValue = dotProp.get(dataParsed, valuePath);
                        let oldValue = dotProp.get(device, valuePath);
                        if (newValue !== oldValue) {
                            if (!(key in changed)) changed[key] = [];
                            changed[key].push(state_name);
                            dotProp.set(device, valuePath, newValue);
                        }
                    });
                }
            });
            return changed;
        }

        onSocketMessageChanged(dataParsed) {
            let that = this;
            let path = that.formatPath(dataParsed.r, dataParsed.uniqueid, dataParsed.id);
            let changed = that.updateDevice(path, dataParsed);

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
                        node.sendState(
                            device,
                            dataParsed,
                            false,
                            'state' in dataParsed,
                            'state' in dataParsed,
                            'config' in dataParsed || 'name' in dataParsed
                        );
                    }
                });
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
        }


        onSocketMessageSceneCalled(dataParsed) {
            console.warn("Need to implement onSocketMessageSceneCalled for " + JSON.stringify(dataParsed));
            // TODO implement
        }


        onSocketMessage(dataParsed) {
            let that = this;
            that.emit('onSocketMessage', dataParsed); //Used by event node

            switch (dataParsed.t) {
                case "event":
                    switch (dataParsed.e) {
                        case "added":
                        case "deleted":
                            that.discoverDevices(undefined, true);
                            break;
                        case "changed":
                            that.onSocketMessageChanged(dataParsed);
                            break;
                        case "scene-called":
                            that.onSocketMessageSceneCalled(dataParsed);
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
        }
    }

    RED.nodes.registerType('deconz-server', ServerNode, {
        credentials: {
            secured_apikey: {type: "text"}
        }
    });
};

