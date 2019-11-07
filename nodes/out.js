const DeconzHelper = require('../lib/DeconzHelper.js');
var request = require('request');

module.exports = function(RED) {
    class deConzOut {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;

            node.status({}); //clean

            //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (node.server) {
                node.server.devices[node.id] = node.config.device; //register node in devices list

            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-deconz/out:status.server_node_error"
                });
            }

            node.payload = config.payload;
            node.payloadType = config.payloadType;
            node.command = config.command;
            node.commandType = config.commandType;
            node.cleanTimer = null;

            // if (typeof(config.device) == 'string'  && config.device.length) {


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
                        case 'deconz_payload':
                            payload = node.payload;
                            break;

                        case 'num': {
                            payload = parseInt(node.config.payload);
                            break;
                        }

                        case 'str': {
                            payload = node.config.payload;
                            break;
                        }

                        case 'object': {
                            payload = node.config.payload;
                            break;
                        }

                        case 'homekit':
                        case 'msg':
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
                                    payload = payload && payload !== '0';
                                    break;

                                case 'toggle':
                                    command = "on";
                                    var deviceMeta = node.server.getDevice(node.config.device);
                                    if (deviceMeta !== undefined && "device_type" in deviceMeta && deviceMeta.device_type === 'groups'  && deviceMeta && "state" in deviceMeta  && "all_on" in deviceMeta.state) {
                                        payload = !deviceMeta.state.all_on;
                                    } else if (deviceMeta !== undefined && deviceMeta && "state" in deviceMeta  && "on" in deviceMeta.state) {
                                        payload = !deviceMeta.state.on;
                                    } else {
                                        payload = false;
                                    }
                                    break;

                                case 'bri':
                                case 'hue':
                                case 'sat':
                                case 'ct':
                                case 'scene': // added scene, payload is the scene ID
                                case 'colorloopspeed':
                                // case 'transitiontime':
                                    payload = parseInt(payload);
                                    break;

                                case 'json':
                                case 'alert':
                                case 'effect':
                                default: {
                                    break;
                                }
                            }
                            break;

                        case 'homekit':
                            payload = node.formatHomeKit(message, payload);
                            break;

                        case 'str':
                        default: {
                            command = node.command;
                            break;
                        }
                    }

                    //empty payload, stop
                    if (payload === null) {
                        return false;
                    }


                    //send data to API
                    var deviceMeta = node.server.getDevice(node.config.device);
                    if (deviceMeta !== undefined && deviceMeta && "device_id" in deviceMeta) {
						if (command == 'scene'){ // make a new URL for recalling the scene
							var groupid = ((node.config.device).split('group_').join(''));
                            var url = 'http://' + node.server.ip + ':' + node.server.port + '/api/' + node.server.apikey + '/groups/' + groupid + '/scenes/' + payload + '/recall';
						} else if ((/group_/g).test(node.config.device)) {
                            var groupid = ((node.config.device).split('group_').join(''));
                            var url = 'http://' + node.server.ip + ':' + node.server.port + '/api/' + node.server.apikey + '/groups/' + groupid + '/action';
                        } else {
                            var url = 'http://' + node.server.ip + ':' + node.server.port + '/api/' + node.server.apikey + '/lights/' + deviceMeta.device_id + '/state';
                        }
                        var post = {};
						if (node.commandType == 'object' || node.commandType == 'homekit') {
                            post = payload;
                        } else if (command != 'scene') { // scene doesn't have a post payload, so keep it empty.
                            if (command != 'on') post['on'] = true;
                            if (command == 'bri') post['on'] = payload > 0 ? true : false;
                            post[command] = payload;
                        }
                        if (parseInt(config.transitionTime) >= 0) {
                            post['transitiontime'] = parseInt(config.transitionTime);
                        }

                        node.postData(url, post);
                    } else {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "node-red-contrib-deconz/out:status.device_not_set"
                        });
                        node.cleanTimer = setTimeout(function(){
                            node.status({}); //clean
                        }, 3000);

                    }
                });
            // } else {
            //     node.status({
            //         fill: "red",
            //         shape: "dot",
            //         text: 'Device not set'
            //     });
            // }
        }



        postData(url, post) {
            var node = this;
            // node.log('Requesting url: '+url);
            // console.log(post);

            request.put({
                url:     url,
                form:    JSON.stringify(post)
            }, function(error, response, body){
                if (error && typeof(error) === 'object') {
                    node.warn(error);
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "node-red-contrib-deconz/out:status.connection"
                    });

                    node.cleanTimer = setTimeout(function(){
                        node.status({}); //clean
                    }, 3000);
                } else if (body) {
                    var response = JSON.parse(body)[0];

                    if ('success' in response) {
                        node.status({
                            fill: "green",
                            shape: "dot",
                            text: "node-red-contrib-deconz/out:status.ok"
                        });
                    } else if ('error' in response) {
                        response.error.post = post; //add post data
                        node.warn('deconz-out ERROR: '+response.error.description);
                        node.warn(response.error);
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "node-red-contrib-deconz/out:status.error"
                        });
                    }

                    node.cleanTimer = setTimeout(function(){
                        node.status({}); //clean
                    }, 3000);
                }
            });
        }

        formatHomeKit(message, payload) {
            if (message.hap.context === undefined) {
                return null;
            }

            var node = this;
            // var deviceMeta = node.server.getDevice(node.config.device);


            var msg = {};

            if (payload.On !== undefined) {
                msg['on'] = payload.On;
            } else if (payload.Brightness !== undefined) {
                msg['bri'] =  DeconzHelper.convertRange(payload.Brightness, [0,100], [0,255]);
                if (payload.Brightness >= 254) payload.Brightness = 255;
                msg['on'] = payload.Brightness > 0
            } else if (payload.Hue !== undefined) {
                msg['hue'] = DeconzHelper.convertRange(payload.Hue,  [0,360], [0,65535]);
                msg['on'] = true;
            } else if (payload.Saturation !== undefined) {
                msg['sat'] = DeconzHelper.convertRange(payload.Saturation, [0,100], [0,255]);
                msg['on'] = true;
            } else if (payload.ColorTemperature !== undefined) {
                msg['ct'] = DeconzHelper.convertRange(payload.ColorTemperature, [140,500], [153,500]);
                msg['on'] = true;
            } else if (payload.TargetPosition !== undefined) {
                msg['on'] = payload.TargetPosition > 0;
                msg['bri'] = DeconzHelper.convertRange(payload.TargetPosition, [0,100], [0,255]);
            }


            return msg;
        }
    }

    RED.nodes.registerType('deconz-output', deConzOut);
};












