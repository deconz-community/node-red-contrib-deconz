var request = require('request');

module.exports = function(RED) {
    class deConzOut {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;

            //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (node.server) {

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
                        case 'deconz_payload':
                            payload = node.payload;
                            break;

                        case 'object':
                        case 'homekit':
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
                                    payload = payload && payload !== '0'?true:false;
                                    break;

                                case 'toggle':
                                    command = "on";
                                    var deviceMeta = node.server.getDevice(node.config.device);
                                    if (deviceMeta !== undefined && deviceMeta && "state" in deviceMeta  && "on" in deviceMeta.state) {
                                        payload = !deviceMeta.state.on;
                                    } else {
                                        payload = false;
                                    }
                                    break;

                                case 'bri':
                                case 'hue':
                                case 'sat':
                                case 'ct':
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
                        if ((/group_/g).test(node.config.device)) {
                            var groupid = ((node.config.device).split('group_').join(''));
                            var url = 'http://' + node.server.ip + ':' + node.server.port + '/api/' + node.server.apikey + '/groups/' + groupid + '/action';
                        } else {
                            var url = 'http://' + node.server.ip + ':' + node.server.port + '/api/' + node.server.apikey + '/lights/' + deviceMeta.device_id + '/state';
                        }
                        var post = {};
                        if (node.commandType == 'object' || node.commandType == 'homekit') {
                            post = payload;
                        } else {
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
            node.log('Requesting url: '+url);
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
                msg['bri'] = Math.round(payload.Brightness * 2.55);
                msg['on'] = payload.Brightness > 0 ? true : false;
            } else if (payload.Hue !== undefined) {
                msg['hue'] = payload.Hue * 182;
                msg['on'] = true;
            } else if (payload.Saturation !== undefined) {
                msg['sat'] = Math.round(payload.Saturation * 2.55);
                msg['on'] = true;
            } else if (payload.ColorTemperature !== undefined) {
                msg['ct'] = payload.ColorTemperature;
                msg['on'] = true;
            } else if (payload.TargetPosition !== undefined) {
                msg['on'] = payload.TargetPosition>0;
                msg['bri'] = Math.round(payload.TargetPosition * 2.55);
            }


            return msg;
        }
    }

    RED.nodes.registerType('deconz-output', deConzOut);
};












