var request = require('request');
var NODE_PATH = '/deconz/';

module.exports = function (RED) {

    var devices = {};

    /**
     * httpAdmin.get
     *
     * Enable http route to static files
     *
     */
    RED.httpAdmin.get(NODE_PATH + 'static/*', function (req, res) {
        var options = {
            root: __dirname + '/static/',
            dotfiles: 'deny'
        };
        res.sendFile(req.params[0], options);
    });


    /**
     * httpAdmin.get
     *
     * Enable http route to JSON itemlist for each controller (controller id passed as GET query parameter)
     *
     */
    RED.httpAdmin.get(NODE_PATH + 'itemlist', function (req, res) {
        var config = req.query;
        var controller = RED.nodes.getNode(config.controllerID);
        var forceRefresh = config.forceRefresh ? ['1', 'yes', 'true'].includes(config.forceRefresh.toLowerCase()) : false;

        if (controller && controller instanceof deConzServerNode) {
            controller.getItemsList(function (items) {
                if (items) {
                    res.json(items);
                } else {
                    res.status(404).end();
                }
            }, forceRefresh);
        } else {
            res.status(404).end();
        }
    });

    RED.httpAdmin.get(NODE_PATH + 'statelist', function (req, res) {
        var config = req.query;
        var controller = RED.nodes.getNode(config.controllerID);
        var forceRefresh = config.forceRefresh ? ['1', 'yes', 'true'].includes(config.forceRefresh.toLowerCase()) : false;

        if (controller && controller instanceof deConzServerNode) {
            controller.getDeviceMeta(function (items) {
                if (items) {
                    res.json(items.state);
                } else {
                    res.status(404).end();
                }
            }, config.uniqueid);
        } else {
            res.status(404).end();
        }
    });


    RED.httpAdmin.get(NODE_PATH + 'getDeviceMeta', function (req, res) {
        var config = req.query;
        var controller = RED.nodes.getNode(config.controllerID);
        var forceRefresh = config.forceRefresh ? ['1', 'yes', 'true'].includes(config.forceRefresh.toLowerCase()) : false;
        var uniqueid = config.uniqueid;

        if (controller && controller instanceof deConzServerNode) {
            controller.getDeviceMeta(function (meta) {
                if (meta) {
                    res.json(meta);
                } else {
                    res.status(404).end();
                }
            }, uniqueid);
        } else {
            res.status(404).end();
        }
    });

    //*************** Input Node ***************
    function deConzItemIn(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.config = config;

        if (typeof (config.device) == 'string' && config.device.length) {
            node.server = RED.nodes.getNode(config.server);
            node.server.getDeviceMeta(function (deviceMeta) {
                if (deviceMeta) {
                    devices[node.id] = deviceMeta.uniqueid;

                    node.meta = deviceMeta;

                    node.status({
                        fill: "green",
                        shape: "dot",
                        text: (config.state in node.meta.state) ? (node.meta.state[config.state] ? node.meta.state[config.state] : '') : "connected",
                    });

                    node.send({
                        payload: (config.state in node.meta.state) ? node.meta.state[config.state] : node.meta.state,
                        meta: deviceMeta,
                    });
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: 'Device not found'
                    });
                }
            }, config.device);
        } else {
            node.status({
                fill: "red",
                shape: "dot",
                text: 'Device not set'
            });
        }

    }
    RED.nodes.registerType("deconz-input", deConzItemIn);


    //*************** GET Node ***************
    function deConzItemGet(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.config = config;
        node.cleanTimer = null;
        node.server = RED.nodes.getNode(config.server);
        if (typeof(config.device) == 'string'  && config.device.length) {
            node.status({}); //clean

            this.on('input', function (message) {
                clearTimeout(node.cleanTimer);
                
                node.server.getDeviceMeta(function(deviceMeta){
                    if (deviceMeta) {
                        devices[node.id] = deviceMeta.uniqueid;

                        node.meta = deviceMeta;

                        node.status({
                            fill: "green",
                            shape: "dot",
                            text: (config.state in node.meta.state)?(node.meta.state[config.state]?node.meta.state[config.state]:''):"received",
                        });

                        node.send({
                            payload:(config.state in node.meta.state)?node.meta.state[config.state]:node.meta.state,
                            meta:deviceMeta,
                        });

                        node.cleanTimer = setTimeout(function(){
                            node.status({}); //clean
                        }, 3000);
                    } else {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: 'Device not found'
                        });
                    }
                }, config.device);

            });
        } else {
            node.status({
                fill: "red",
                shape: "dot",
                text: 'Device not set'
            });
        }
    }

    RED.nodes.registerType("deconz-get", deConzItemGet);


    //*************** State Output Node ***************
    function deConzOut(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.device = config.device;
        node.server = RED.nodes.getNode(config.server);
        node.payload = config.payload;
        node.payloadType = config.payloadType;
        node.command = config.command;
        node.commandType = config.commandType;


        this.on('input', function (message) {
        });
    }

    RED.nodes.registerType("deconz-output", deConzOut);


    //*************** Server Node ***************
    function deConzServerNode(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        node.items = undefined;
        node.items_list = undefined;
        node.name = n.name;
        node.ip = n.ip;
        node.port = n.port;
        node.ws_port = n.ws_port;
        node.apikey = n.apikey;




        this.discoverDevices = function (callback, forceRefresh = false) {
            if (forceRefresh || node.items === undefined) {
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
                        dataParsed = dataParsed.sensors;
                        for (var index in dataParsed) {
                            var prop = dataParsed[index];

                            node.items[prop.uniqueid] = prop;
                        }
                    }

                    callback(node.items);
                    return node.items;
                });
            } else {
                node.log('discoverDevices: Using cached devices');
                callback(node.items);
                return node.items;
            }
        }

        this.getDeviceMeta = function (callback, uniqueid) {
            var result = null;

            node.discoverDevices(function(items){
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
        }

        this.getItemsList = function (callback, forceRefresh = false) {
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

        // this.discoverDevices(node);
        connect({host:node.ip, port:node.ws_port});

    }

    RED.nodes.registerType("deconz-server", deConzServerNode);


    function connect(config) {

        const WebSocket = require('ws');
        const ws = new WebSocket('ws://' + config.host + ':' + config.port);

        ws.on('open', function open() {
            console.log('Connected to WebSocket');

        });

        ws.on('error',  function(err) {
            // need to get both the statusCode and the reason phrase
            console.log(err);
        });

        ws.on('message', function(data) {
            if (data) {
                var dataParsed = JSON.parse(data);
                for (var nodeId in devices) {
                    var item = devices[nodeId];

                    if (dataParsed.uniqueid === item) {
                        var node = RED.nodes.getNode(nodeId);
                        if (node && node.type === "deconz-input") {

                            var serverNode = RED.nodes.getNode(node.server.id);
                            serverNode.items[dataParsed.uniqueid].state = dataParsed.state; //set last state

                            node.status({
                                fill: "green",
                                shape: "dot",
                                text: (node.config.state in dataParsed.state) ? dataParsed.state[node.config.state] : "connected"
                            });

                            node.send({
                                payload: (node.config.state in dataParsed.state) ? dataParsed.state[node.config.state] : dataParsed.state,
                                event: dataParsed
                            });
                        }
                    }
                }
            }
        });

        ws.on('close', function close() {
            console.log('disconnected');
        });
    }

    function disconnect(config) {}
}
