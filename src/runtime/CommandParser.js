const Utils = require("./Utils");

class CommandParser {

    constructor(command, message_in, node) {
        this.type = command.type;
        this.domain = command.domain;
        this.valid_domain = [];
        this.arg = command.arg;
        this.message_in = message_in;
        this.node = node;
        this.result = {
            config: {},
            state: {}
        };

        switch (this.type) {
            case 'deconz_state':
                switch (this.domain) {
                    case 'lights':
                        this.valid_domain.push('lights');
                        this.parseDeconzStateLightArgs();
                        break;
                    case 'covers':
                        this.valid_domain.push('covers');
                        this.parseDeconzStateCoverArgs();
                        break;
                    case 'groups':
                        this.valid_domain.push('groups');
                        this.parseDeconzStateLightArgs();
                        break;
                    case 'scene_call':
                        this.parseDeconzStateSceneCallArgs();
                        break;
                }
                break;
            case 'homekit':
                this.valid_domain.push('lights');
                this.valid_domain.push('group');
                this.parseHomekitArgs();
                break;
            case 'custom':
                this.valid_domain.push('any');
                this.parseCustomArgs();
                break;
        }
    }

    parseDeconzStateLightArgs() {
        // On command
        this.result.state.on = this.getNodeProperty(
            this.arg.on,
            [
                'toggle'
            ],
            [
                ['keep', undefined],
                ['set.true', true],
                ['set.false', false]
            ]
        );
        if (['on', 'true'].includes(this.result.state.on))
            this.result.state.on = true;
        if (['off', 'false'].includes(this.result.state.on))
            this.result.state.on = false;

        // Colors commands
        for (const k of ['bri', 'sat', 'hue', 'ct', 'xy']) {
            if (
                this.arg[k] === undefined ||
                this.arg[k].value === undefined ||
                this.arg[k].value.length === 0
            ) continue;
            switch (this.arg[k].direction) {
                case 'set':
                    if (k === 'xy') {
                        let xy = this.getNodeProperty(this.arg.xy);
                        if (Array.isArray(xy) && xy.length === 2) {
                            this.result.state[k] = xy.map(Number);
                        }
                    } else {
                        this.result.state[k] = Number(this.getNodeProperty(this.arg[k]));
                    }
                    break;
                case 'inc':
                    this.result.state[`${k}_inc`] = Number(this.getNodeProperty(this.arg[k]));
                    break;
                case 'dec':
                    this.result.state[`${k}_inc`] = -Number(this.getNodeProperty(this.arg[k]));
                    break;
                case 'detect_from_value':
                    let value = this.getNodeProperty(this.arg[k]);
                    switch (typeof value) {
                        case 'string':
                            switch (value.substr(0, 1)) {
                                case '+':
                                    this.result.state[`${k}_inc`] = Number(value.substr(1));
                                    break;
                                case '-':
                                    this.result.state[`${k}_inc`] = -Number(value.substr(1));
                                    break;
                                default:
                                    this.result.state[k] = Number(value);
                                    break;
                            }
                            break;
                        default :
                            this.result.state[k] = Number(value);
                            break;
                    }
                    break;
            }
        }

        for (const k of ['alert', 'effect', 'colorloopspeed', 'transitiontime']) {
            if (this.arg[k] === undefined || this.arg[k].value === undefined) continue;
            if (this.arg[k].value.length > 0)
                this.result.state[k] = this.getNodeProperty(this.arg[k]);
        }
    }

    parseDeconzStateCoverArgs() {
        this.result.state.open = this.getNodeProperty(
            this.arg.open,
            [
                'toggle'
            ],
            [
                ['keep', undefined],
                ['set.true', true],
                ['set.false', false]
            ]
        );

        this.result.state.stop = this.getNodeProperty(
            this.arg.stop,
            [],
            [
                ['keep', undefined],
                ['set.true', true],
                ['set.false', false]
            ]
        );

        this.result.state.lift = this.getNodeProperty(this.arg.lift, ['stop']);
        this.result.state.tilt = this.getNodeProperty(this.arg.tilt);
    }

    parseDeconzStateSceneCallArgs() {
        this.result.scene_call = {
            groupId: this.getNodeProperty(this.arg.group),
            sceneId: this.getNodeProperty(this.arg.scene)
        };
    }

    parseHomekitArgs() {
        // Based on legacy code
        let HK = this.getNodeProperty(this.arg.payload);
        if (HK.On !== undefined) {
            this.result.state.on = HK.On;
        } else if (HK.Brightness !== undefined) {
            this.result.state.bri = Utils.convertRange(HK.Brightness, [0, 100], [0, 255]);
            if (HK.Brightness >= 254) HK.Brightness = 255;
            this.result.state.on = HK.Brightness > 0;
        } else if (HK.Hue !== undefined) {
            this.result.state.hue = Utils.convertRange(HK.Hue, [0, 360], [0, 65535]);
            this.result.state.on = true;
        } else if (HK.Saturation !== undefined) {
            this.result.state.sat = Utils.convertRange(HK.Saturation, [0, 100], [0, 255]);
            this.result.state.on = true;
        } else if (HK.ColorTemperature !== undefined) {
            this.result.state.ct = Utils.convertRange(HK.ColorTemperature, [140, 500], [153, 500]);
            this.result.state.on = true;
        }
        if (HK.TargetPosition !== undefined) {
            this.result.state.lift = Utils.convertRange(HK.TargetPosition, [100, 0], [0, 100]);
        }
        if (HK.TargetHorizontalTiltAngle !== undefined) {
            this.result.state.tilt = Utils.convertRange(HK.TargetHorizontalTiltAngle, [-90, 90], [0, 100]);
        }
        this.result.state.transitiontime = this.getNodeProperty(this.arg.transitiontime);
    }

    parseCustomArgs() {
        let target = this.getNodeProperty(this.arg.target, ['attribute', 'state', 'config']);
        let command = this.getNodeProperty(this.arg.command, ['object']);
        let value = this.getNodeProperty(this.arg.payload);
        switch (target) {
            case 'attribute':
                if (command === 'object') {
                    this.result = value;
                } else {
                    this.result[command] = value;
                }
                break;
            case 'state':
            case 'config':
                if (command === 'object') {
                    this.result[target] = value;
                } else {
                    this.result[target][command] = value;
                }
                break;
        }
    }

    /**
     *
     * @param node Node
     * @param devices Device[]
     * @returns {*[]}
     */
    getRequests(node, devices) {
        let deconzApi = node.server.api;
        let requests = [];

        if (this.type === 'deconz_state' && this.domain === 'scene_call') {
            let request = {};
            request.endpoint = deconzApi.url.groups.scenes.recall(
                this.result.scene_call.groupId,
                this.result.scene_call.sceneId
            );
            request.meta = node.server.device_list.getDeviceByDomainID(
                'groups',
                this.result.scene_call.groupId
            );

            if (request.meta && Array.isArray(request.meta.scenes)) {
                request.scene_meta = request.meta.scenes.filter(
                    scene => Number(scene.id) === this.result.scene_call.sceneId
                ).shift();
            }

            request.params = Utils.clone(this.result);
            requests.push(request);
        } else {
            for (let device of devices) {
                // If the device type do not match the command type skip the device
                if (!this.valid_domain.includes('any') &&
                    (Utils.isDeviceCover(device.data) && !this.valid_domain.includes('cover') ||
                        !this.valid_domain.includes(device.data.device_type))
                ) continue;

                // Make sure that the endpoint exist
                let deviceTypeEndpoint = deconzApi.url[device.data.device_type];
                if (deviceTypeEndpoint === undefined)
                    throw new Error('Invalid device endpoint, got ' + device.data.device_type);

                // Attribute request
                if (Object.keys(this.result.config).length > 0) {
                    let request = {};
                    request.endpoint = deviceTypeEndpoint.main(device.data.device_id);
                    request.meta = device.data;
                    request.params = Utils.clone(this.result);
                    delete request.params.state;
                    delete request.params.config;
                    requests.push(request);
                }

                // State request
                if (Object.keys(this.result.state).length > 0) {
                    let request = {};
                    request.endpoint = deviceTypeEndpoint.action(device.data.device_id);
                    request.meta = device.data;
                    request.params = Utils.clone(this.result.state);

                    if (request.params.on === 'toggle') {
                        switch (device.data.device_type) {
                            case 'lights':
                                request.params.on = !device.data.state.on;
                                break;
                            case 'groups':
                                delete request.params.on;
                                request.params.toggle = true;
                                break;
                        }
                    }
                    requests.push(request);
                }

                // Config request
                if (Object.keys(this.result.config).length > 0) {
                    let request = {};
                    request.endpoint = deviceTypeEndpoint.config(device.data.device_id);
                    request.meta = device.data;
                    request.params = Utils.clone(this.result.config);
                    requests.push(request);
                }
            }
        }

        // Remove undefined params in requests
        for (const request of requests)
            for (const [k, v] of Object.entries(request.params))
                if (v === undefined) delete request.params[k];

        return requests;
    }

    getNodeProperty(property, noValueTypes, valueMaps) {
        if (typeof property === 'undefined') return undefined;
        if (Array.isArray(valueMaps))
            for (const map of valueMaps)
                if (Array.isArray(map) && map.length === 2 &&
                    (property.type === map[0] || `${property.type}.${property.value}` === map[0])
                ) return map[1];
        return Utils.getNodeProperty(property, this.node, this.message_in, noValueTypes);
    }

}

module.exports = CommandParser;