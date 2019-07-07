var request = require('request');
const DeconzSocket = require('../lib/deconz-socket');

module.exports = function(RED) {
    class ServerNode {
        constructor(n) {
            RED.nodes.createNode(this, n);

            var node = this;
            node.items = undefined;
            node.groups = undefined;
            node.items_list = undefined;
            node.discoverProcess = false;
            node.name = n.name;
            node.ip = n.ip;
            node.port = n.port;
            node.ws_port = n.ws_port;
            node.apikey = n.apikey;
            node.pingTimeout = undefined;
            node.devices = {};



            node.socket = new DeconzSocket({
                hostname: this.ip,
                port: this.ws_port,
                secure: false
            });
            node.socket.on('close', (code, reason) => this.onSocketClose(code, reason));
            node.socket.on('unauthorized', () => this.onSocketUnauthorized());
            node.socket.on('open', () => this.onSocketOpen());
            node.socket.on('message', (payload) => this.onSocketMessage(payload));
            node.socket.on('error', (err) => this.onSocketError(err));
            node.socket.on('pong-timeout', () => this.onSocketPongTimeout());

            node.on('close', () => this.onClose());


            node.discoverDevices = function (callback, forceRefresh = false) {
                if (forceRefresh || node.items === undefined) {
                    node.discoverProcess = true;
                    node.log('discoverDevices: Refreshing devices list');

                    var url = "http://" + node.ip + ":" + node.port + "/api/" + node.apikey;
                    node.log('discoverDevices: Requesting: ' + url);

                    request.get(url, function (error, result, data) {
                        if (error) {
                            callback(error);
                            return;
                        }

                        try {
                            var dataParsed = JSON.parse(data);
                        } catch (e) {
                            callback(RED._("deconz.error.invalid-json"));
                            return;
                        }

                        node.items = [];
                        if (dataParsed) {
                            for (var index in dataParsed.sensors) {
                                var prop = dataParsed.sensors[index];
                                prop.device_type = 'sensors';
                                prop.device_id = parseInt(index);

                                node.items[prop.uniqueid] = prop;
                            }

                            for (var index in dataParsed.lights) {
                                var prop = dataParsed.lights[index];
                                prop.device_type = 'lights';
                                prop.device_id = parseInt(index);

                                node.items[prop.uniqueid] = prop;
                            }

                            if ("groups" in dataParsed) {
                                node.groups = dataParsed.groups;
                                // console.log(node.groups);
                            }
                        }

                        // console.log('discoverProcess = false');
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

            node.getDeviceMeta = function (callback, uniqueid) {
                var result = null;

                if (node.items === undefined && !node.discoverProcess) {
                    node.discoverDevices(function (items) {
                        if (items) {
                            for (var index in items) {
                                var item = items[index];
                                if (index === uniqueid) {
                                    result = item;
                                    break;
                                }
                            }
                        }

                        callback(result);
                        return result;
                    }, false);
                } else {
                    if (node.getDiscoverProcess()) {
                        var refreshIntervalId = setInterval(function(){
                            if (!node.getDiscoverProcess()) {
                                clearInterval(refreshIntervalId);

                                result = [];
                                if ((node.items)) {
                                    for (var index in (node.items)) {
                                        var item = (node.items)[index];
                                        if (index === uniqueid) {
                                            result = item;
                                            break;
                                        }
                                    }
                                }
                                callback(result);
                                return result;
                            }
                        }, 100);
                    } else {
                        result = [];
                        if ((node.items)) {
                            for (var index in (node.items)) {
                                var item = (node.items)[index];
                                if (index === uniqueid) {
                                    result = item;
                                    break;
                                }
                            }
                        }
                        callback(result);
                        return result;
                    }
                }
            }

            node.getItemsList = function (callback, forceRefresh = false) {
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

                    callback(node.items_list, node.groups);
                    return node.items_list;
                }, forceRefresh);
            }

            node.getDiscoverProcess = function() {
                return node.discoverProcess;
            }
        }





        get deconz() {
            return this.socket;
        }

        onClose() {
            this.socket.close();
            this.socket = null;

            for (var nodeId in this.devices) {
                var node = RED.nodes.getNode(nodeId);
                if (node) {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: 'disconnected'
                    });
                }
            }
        }

        onSocketPongTimeout() {
            this.warn('WebSocket connection timeout, reconnecting');

            for (var nodeId in this.devices) {
                var node = RED.nodes.getNode(nodeId);
                if (node) {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: 'disconnected'
                    });
                }
            }
        }

        onSocketClose(code, reason) {
            if (reason) { // don't bother the user unless there's a reason
                this.warn(`WebSocket disconnected: ${code} - ${reason}`);
            }

            for (var nodeId in this.devices) {
                var node = RED.nodes.getNode(nodeId);
                if (node) {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: 'disconnected'
                    });
                }
            }
        }

        onSocketUnauthorized() {
            this.warn('WebSocket authentication failed');
        }

        onSocketError(err) {
            this.warn(`WebSocket error: ${err}`);

            for (var nodeId in this.devices) {
                var node = RED.nodes.getNode(nodeId);
                if (node) {
                    node.status({
                        fill: "yellow",
                        shape: "dot",
                        text: 'reconnecting...'
                    });
                }
            }
        }

        onSocketOpen(err) {
            // this.warn(`WebSocket opened`);

            // if ("sendLastState" in config && config.sendLastState) {
                for (var nodeId in this.devices) {
                    var node = RED.nodes.getNode(nodeId);
                    if (node && typeof (node.sendLastState) == 'function') {
                        node.sendLastState();
                    }
                }
            // }
        }

        onSocketMessage(dataParsed) {
            for (var nodeId in this.devices) {
                var item = this.devices[nodeId];

                if ("event" == item && "t" in dataParsed && dataParsed.t == "event") {
                    var node = RED.nodes.getNode(nodeId);
                    if (node && "type" in node && node.type === "deconz-event") {
                        var serverNode = RED.nodes.getNode(node.server.id);
                        node.send({'payload': dataParsed, 'device': serverNode.items[dataParsed.uniqueid]});
                        clearTimeout(node.cleanTimer);
                        node.status({
                            fill: "green",
                            shape: "dot",
                            text: 'event'
                        });
                        node.cleanTimer = setTimeout(function () {
                            node.status({}); //clean
                        }, 3000);
                    }
                }

                if (dataParsed.uniqueid === item) {
                    var node = RED.nodes.getNode(nodeId);
                    if (node && "server" in node) {
                        //update server items db
                        var serverNode = RED.nodes.getNode(node.server.id);
                        if ("items" in serverNode && dataParsed.uniqueid in serverNode.items) {
                            serverNode.items[dataParsed.uniqueid].state = dataParsed.state;

                            if (node.type === "deconz-input") {
                                // console.log(dataParsed);
                                node.sendState(dataParsed);
                            }
                        }
                    } else {
                        console.log('ERROR: cant get '+nodeId+' node, removed from list');
                        delete node.devices[nodeId];

                        if ("server" in node) {
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

