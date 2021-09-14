const Utils = require("./Utils");

class CommandParser {

    constructor(command, message_in, node) {
        this.type = command.type;
        this.domain = command.domain;
        this.arg = command.arg;
        this.message_in = message_in;
        this.node = node;
        this.result = {};

        switch (this.type) {
            case 'deconz_state':
                this.parseDeconzStateArgs();
                break;
            case 'homekit':
                this.parseHomekitArgs();
                break;
            case 'custom':
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
                if (this.arg.on.value === 'true') this.result.on = true;
                if (this.arg.on.value === 'false') this.result.on = false;
                break;
            case 'toggle':
                this.result.on = 'toggle';
                break;
            case 'msg':
            case 'flow':
            case 'global':
            case 'jsonata':
                this.result.on = this.getNodeProperty(this.arg.on);
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
                            this.result[k] = xy.map(Number);
                        }
                    } else {
                        this.result[k] = Number(this.getNodeProperty(this.arg[k]));
                    }
                    break;
                case 'inc':
                    this.result[`${k}_inc`] = Number(this.getNodeProperty(this.arg[k]));
                    break;
                case 'dec':
                    this.result[`${k}_inc`] = -Number(this.getNodeProperty(this.arg[k]));
                    break;
                case 'detect_from_value':
                    let value = this.getNodeProperty(this.arg[k]);
                    switch (typeof value) {
                        case 'string':
                            switch (value.substr(0, 1)) {
                                case '+':
                                    this.result[`${k}_inc`] = Number(value.substr(1));
                                    break;
                                case '-':
                                    this.result[`${k}_inc`] = -Number(value.substr(1));
                                    break;
                                default:
                                    this.result[k] = Number(value);
                                    break;
                            }
                            break;
                        default :
                            this.result[k] = Number(value);
                            break;
                    }
                    break;
            }
        }

        for (const k of ['alert', 'effect', 'colorloopspeed', 'transitiontime'])
            if (this.arg[k].value.length > 0)
                this.result[k] = this.getNodeProperty(this.arg[k]);
    }

    parseHomekitArgs() {
        // Based on legacy code
        let HK = this.getNodeProperty(this.arg.payload);
        if (HK.On !== undefined) {
            this.result.on = HK.On;
        } else if (HK.Brightness !== undefined) {
            this.result.bri = Utils.convertRange(HK.Brightness, [0, 100], [0, 255]);
            if (HK.Brightness >= 254) HK.Brightness = 255;
            this.result.on = HK.Brightness > 0;
        } else if (HK.Hue !== undefined) {
            this.result.hue = Utils.convertRange(HK.Hue, [0, 360], [0, 65535]);
            this.result.on = true;
        } else if (HK.Saturation !== undefined) {
            this.result.sat = Utils.convertRange(HK.Saturation, [0, 100], [0, 255]);
            this.result.on = true;
        } else if (HK.ColorTemperature !== undefined) {
            this.result.ct = Utils.convertRange(HK.ColorTemperature, [140, 500], [153, 500]);
            this.result.on = true;
        } else if (HK.TargetPosition !== undefined) {
            this.result.on = HK.TargetPosition > 0;
            this.result.bri = Utils.convertRange(HK.TargetPosition, [0, 100], [0, 255]);
        }
        this.result.transitiontime = this.getNodeProperty(this.arg.transitiontime);
    }

    parseCustomArgs() {

    }

    getRequests(devices) {
        let requests = [];
        for (let device of devices) {
            let request = {};
            request.device_type = device.data.device_type;
            request.device_id = device.data.device_id;
            request.params = this.result;
            request.meta = device.data;

            if (request.params.on === 'toggle') {
                switch (device.data.device_type) {
                    case 'lights':
                        request.params.on = !device.data.state.on;
                        break;
                    case 'groups':
                        request.params.on = !device.data.state.all_on;
                        break;
                }
            }

            requests.push(request);
        }
        return requests;
    }

    getNodeProperty(property) {
        return Utils.getNodeProperty(property, this.node, this.message_in);
    }

}

module.exports = CommandParser;