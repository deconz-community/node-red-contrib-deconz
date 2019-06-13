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
        node.server = RED.nodes.getNode(config.server);

        //check if this device exists
        node.server.getDeviceMeta(function(deviceMeta){
            if (!deviceMeta) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: 'Device not found'
                });
            }
        }, config.device);

        if (typeof (config.device) == 'string' && config.device.length) {
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


        //check if this device exists
        node.server.getDeviceMeta(function(deviceMeta){
            if (!deviceMeta) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: 'Device not found'
                });
            }
        }, config.device);


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
        node.cleanTimer = null;

        //check if this device exists
        node.server.getDeviceMeta(function(deviceMeta){
            if (!deviceMeta) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: 'Device not found'
                });
            }
        }, config.device);

        if (typeof(config.device) == 'string'  && config.device.length) {
            node.status({}); //clean

            this.on('input', function (message) {
                clearTimeout(node.cleanTimer);

                var payload;
                switch (node.payloadType) {
                    case 'flow':
                    case 'global': {
                        RED.util.evaluateNodeProperty(node.payload, node.payloadType, this, message, function (error, result) {
                            if (error) {
                                node.error(error, message);
                            } else {
                                payload = result;
                            }
                        });
                        break;
                    }
                    case 'date': {
                        payload = Date.now();
                        break;
                    }
                    case 'msg':
                    case 'num':
                    case 'str':
                    default: {
                        payload = message[node.payload];
                        break;
                    }
                }

                var command;
                switch (node.commandType) {
                    case 'msg': {
                        command = message[node.command];
                        break;
                    }
                    case 'deconz_cmd':
                        command = node.command;
                        switch (command) {
                            case 'on':
                                payload = payload && payload != '0'?true:false;
                                break;

                            case 'bri':
                            case 'hue':
                            case 'sat':
                            case 'ct':
                            case 'colorloopspeed':
                            case 'transitiontime':
                                payload = parseInt(payload);
                                break;

                            case 'alert':
                            case 'effect':
                            default: {
                                break;
                            }
                        }
                        break;

                    case 'str':
                    default: {
                        command = node.command;
                        break;
                    }
                }

                node.server.getDeviceMeta(function(deviceMeta){
                    if (deviceMeta) {
                        var url = 'http://'+node.server.ip+':'+node.server.port+'/api/'+node.server.apikey+'/lights/'+deviceMeta.device_id+'/state';
                        var post = {};
                        if (command != 'on') post['on'] = true;
                        if (command == 'bri') post['on'] = payload>0?true:false;;
                        post[command] = payload;


                        // post["on"] = true;
                        node.log('Requesting url: '+url);

                        request.put({
                            url:     url,
                            form:    JSON.stringify(post)
                        }, function(error, response, body){
                            if (body) {
                                var response = JSON.parse(body)[0];

                                if ('success' in response) {
                                    node.status({
                                        fill: "green",
                                        shape: "dot",
                                        text: "ok",
                                    });
                                } else if ('error' in response) {
                                    response.error.post = post; //add post data
                                    node.warn('deconz-out ERROR: '+response.error.description);
                                    node.warn(response.error);
                                    node.status({
                                        fill: "red",
                                        shape: "dot",
                                        text: "error",
                                    });
                                }

                                node.cleanTimer = setTimeout(function(){
                                    node.status({}); //clean
                                }, 3000);
                            }
                        });

                    } else {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: 'Device not found'
                        });
                    }
                }, config.device);




                // /api/<apikey>/lights/<id>/state
            });
        } else {
            node.status({
                fill: "red",
                shape: "dot",
                text: 'Device not set'
            });
        }
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
                    }
                    // console.log(node.items);
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
