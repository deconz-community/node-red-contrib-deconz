const Utils = require("./Utils");

class CommandParser {

    constructor(command, message_in, node) {
        this.type = command.type;
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
                switch (command.domain) {
                    case 'lights':
                        this.valid_domain.push('lights');
                        break;
                    case 'covers':
                        this.valid_domain.push('covers');
                        break;
                    case 'groups':
                    case 'scene_call':
                        this.valid_domain.push('groups');
                        break;
                }
                this.parseDeconzStateArgs();
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

    parseDeconzStateArgs() {
        // On command
        switch (this.arg.on.type) {
            case 'keep':
                break;
            case 'set':
                if (this.arg.on.value === 'true') this.result.state.on = true;
                if (this.arg.on.value === 'false') this.result.state.on = false;
                break;
            case 'toggle':
                this.result.state.on = 'toggle';
                break;
            case 'msg':
            case 'flow':
            case 'global':
            case 'jsonata':
                this.result.state.on = this.getNodeProperty(this.arg.on);
                break;
        }

        // Colors commands
        for (const k of ['bri', 'sat', 'hue', 'ct', 'xy']) {
            if (this.arg[k].value.length === 0) continue;
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

        for (const k of ['alert', 'effect', 'colorloopspeed', 'transitiontime'])
            if (this.arg[k].value.length > 0)
                this.result.state[k] = this.getNodeProperty(this.arg[k]);
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
        } else if (HK.TargetPosition !== undefined) {
            this.result.state.on = HK.TargetPosition > 0;
            this.result.state.bri = Utils.convertRange(HK.TargetPosition, [0, 100], [0, 255]);
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
     * @param devices Device[]
     * @param deconzApi DeconzAPI
     * @returns {*[]}
     */
    getRequests(devices, deconzApi) {
        let requests = [];
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
        return requests;
    }

    getNodeProperty(property, noValueTypes) {
        return Utils.getNodeProperty(property, this.node, this.message_in, noValueTypes);
    }

}

module.exports = CommandParser;