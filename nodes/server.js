var request = require('request');
const DeconzSocket = require('../lib/deconz-socket');

module.exports = function(RED) {
    class ServerNode {
        constructor(n) {
            RED.nodes.createNode(this, n);

            var node = this;
            node.items = undefined;
            node.items_list = undefined;
            node.discoverProcess = false;
            node.name = n.name;
            node.ip = n.ip;
            node.port = n.port;
            node.ws_port = n.ws_port;
            node.secure = n.secure || false;
            node.apikey = n.apikey;
            node.devices = {};

            node.setMaxListeners(255);
            node.refreshDiscoverTimer = null;
            node.refreshDiscoverInterval = n.polling >= 3? n.polling*1000 : 15000;

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

            node.discoverDevices(function(){}, true);

            this.refreshDiscoverTimer = setInterval(function () {
                node.discoverDevices(function(){}, true);
            }, node.refreshDiscoverInterval);
        }


        discoverDevices(callback, forceRefresh = false) {
            var node = this;

            if (forceRefresh || node.items === undefined) {
                node.discoverProcess = true;
                // node.log('discoverDevices: Refreshing devices list');

                var url = "http://" + node.ip + ":" + node.port + "/api/" + node.apikey;
                // node.log('discoverDevices: Requesting: ' + url);


                request.get(url, function (error, result, data) {

                    if (error) {
                        node.discoverProcess = false;
                        callback(false);
                        return;
                    }

                    try {
                        var dataParsed = JSON.parse(data);
                    } catch (e) {
                        node.discoverProcess = false;
                        callback(false);
                        return;
                    }

                    node.oldItemsList = node.items !== undefined?node.items:undefined;
                    node.items = [];
                    if (dataParsed) {
                        for (var index in dataParsed.sensors) {
                            var prop = dataParsed.sensors[index];
                            prop.device_type = 'sensors';
                            prop.device_id = parseInt(index);

                            if (node.oldItemsList !== undefined && prop.uniqueid  in node.oldItemsList) {} else {
                                node.items[prop.uniqueid] = prop;
                                node.emit("onNewDevice", prop.uniqueid);
                            }
                            node.items[prop.uniqueid] = prop;
                        }

                        for (var index in dataParsed.lights) {
                            var prop = dataParsed.lights[index];
                            prop.device_type = 'lights';
                            prop.device_id = parseInt(index);

                            if (node.oldItemsList !== undefined && prop.uniqueid  in node.oldItemsList) {} else {
                                node.items[prop.uniqueid] = prop;
                                node.emit("onNewDevice", prop.uniqueid);
                            }
                            node.items[prop.uniqueid] = prop;
                        }

                        for (var index in dataParsed.groups) {
                            var prop = dataParsed.groups[index];
                            prop.device_type = 'groups';
                            var groupid = "group_" + parseInt(index);
                            prop.device_id = groupid;
                            prop.uniqueid = groupid;

                            if (node.oldItemsList !== undefined && prop.uniqueid  in node.oldItemsList) {} else {
                                node.items[prop.uniqueid] = prop;
                                node.emit("onNewDevice", prop.uniqueid);
                            }
                            node.items[prop.uniqueid] = prop;
                        }
                    }

                    node.discoverProcess = false;
                    callback(node.items);
                    return node.items;
                });
            } else {
                node.log('discoverDevices: Using cached devices');
                callback(node.items);
                return node.items;
            }
        }

        getDiscoverProcess() {
            var node = this;
            return node.discoverProcess;
        }

        getDevice(uniqueid) {
            var node = this;
            var result = false;
            if (node.items !== undefined && node.items) {
                for (var index in (node.items)) {
                    var item = (node.items)[index];
                    if (index === uniqueid) {
                        result = item;
                        break;
                    }
                }
            }
            return result;
        }

        getItemsList(callback, forceRefresh = false) {
            var node = this;
            node.discoverDevices(function(items){
                node.items_list = [];
                for (var index in items) {
                    var prop = items[index];

                    node.items_list.push({
                        device_name: prop.name + ' : ' + prop.type,
                        uniqueid: prop.uniqueid,
                        meta: prop
                    });
                }

                callback(node.items_list);
                return node.items_list;
            }, forceRefresh);
        }

        onClose() {
            var that = this;
            that.log('WebSocket connection closed');
            that.emit('onClose');

            clearInterval(that.refreshDiscoverTimer);
            that.socket.close();
            that.socket = null;
        }

        onSocketPongTimeout() {
            var that = this;
            that.warn('WebSocket connection timeout, reconnecting');
            that.emit('onSocketPongTimeout');
        }

        onSocketUnauthorized() {
            var that = this;
            that.warn('WebSocket authentication failed');
            that.emit('onSocketUnauthorized');
        }

        onSocketError(err) {
            var that = this;
            that.warn(`WebSocket error: ${err}`);
            that.emit('onSocketError');
        }

        onSocketClose(code, reason) {
            var that = this;
            if (reason) { // don't bother the user unless there's a reason
                that.warn(`WebSocket disconnected: ${code} - ${reason}`);
            }
            that.emit('onSocketClose');
        }

        onSocketOpen(err) {
            var that = this;
            that.log(`WebSocket opened`);
            that.emit('onSocketOpen');
        }

        onSocketMessage(dataParsed) {
            var that = this;
            that.emit('onSocketMessage', dataParsed);

            if (dataParsed.r == "scenes") { return; }

            if (dataParsed.r == "groups") {
               dataParsed.uniqueid = "group_" + dataParsed.id;
            }

            for (var nodeId in that.devices) {
                var item = that.devices[nodeId];
                var node = RED.nodes.getNode(nodeId);

                if (dataParsed.uniqueid === item) {
                    if (node && "server" in node) {
                        //update server items db
                        var serverNode = RED.nodes.getNode(node.server.id);
                        if ("state" in dataParsed && dataParsed.state !== undefined && "items" in serverNode && dataParsed.uniqueid in serverNode.items) {
                            serverNode.items[dataParsed.uniqueid].state = dataParsed.state;

                            if (node.type === "deconz-input") {
                                node.sendState(dataParsed);
                            }
                        }
                    } else {
                        console.log('ERROR: cant get '+nodeId+' node, removed from list');
                        delete that.devices[nodeId];

                        if (node && "server" in node) {
                            var serverNode = RED.nodes.getNode(node.server.id);
                            delete serverNode.items[dataParsed.uniqueid];
                        }
                    }
                }
            }

        }
    }

    RED.nodes.registerType('deconz-server', ServerNode, {});
};

