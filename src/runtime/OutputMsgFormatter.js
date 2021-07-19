const dotProp = require('dot-prop');
const DeconzHelper = require("../../lib/DeconzHelper");

class OutputMsgFormatter {

    constructor(rule, config) {
        this.rule = Object.assign({
            type: 'state',
            payload: ["__complete__"],
            format: 'single',
            output: "always",
            onstart: true,
            onerror: true
        }, rule);
        this.config = config;
    }

    /**
     *
     * @param devices
     * @param rawEvent only for input node
     */
    getMsgs(devices, rawEvent) {
        if (!Array.isArray(devices)) devices = [devices];
        //console.log({rule: this.rule, config: this.config, devices, rawEvent});
        let resultMsgs = [];

        switch (this.rule.format) {
            case 'single':
                for (const device of devices) {
                    if (this.rule.payload.includes('__complete__')) {
                        if (this.checkOutputTime(device)) {
                            resultMsgs.push(this.formatDeviceMsg(device, rawEvent, '__complete__'));
                        }
                    } else if (this.rule.payload.includes('__each__')) {
                        for (const payloadFormat of this.getDevicePayloadList(device)) {
                            if (this.checkOutputTime(device, payloadFormat)) {
                                resultMsgs.push(this.formatDeviceMsg(device, rawEvent, payloadFormat));
                            }
                        }
                    } else {
                        for (const payloadFormat of this.rule.payload) {
                            if (this.checkOutputTime(device, payloadFormat)) {
                                resultMsgs.push(this.formatDeviceMsg(device, rawEvent, payloadFormat));
                            }
                        }
                    }
                }
                break;
            case 'array':
            case 'sum':
            case 'average':
            case 'min':
            case 'max':
                // TODO implement
                break;
        }

        return resultMsgs;

    }


    formatDeviceMsg(device, rawEvent, payloadFormat) {
        let msg = {};

        switch (this.rule.type) {
            case 'attribute':
                msg.payload = this.formatDevicePayload(device.data, payloadFormat);
                break;
            case 'state':
                msg.payload = this.formatDevicePayload(device.data.state, payloadFormat);
                break;
            case 'config':
                msg.payload = this.formatDevicePayload(device.data.config, payloadFormat);
                break;
            case 'homekit':
                msg = this.formatHomeKit(device.data, device.changed, rawEvent);
                break;
        }

        msg.topic = this.config.topic;
        if (payloadFormat !== undefined) msg.payload_format = payloadFormat;
        if (rawEvent !== undefined) msg.payload_raw = rawEvent;
        msg.meta = device.data;
        msg.meta_changed = device.changed;

        return msg;

    }

    formatDevicePayload(device, payloadFormat) {
        if (payloadFormat === '__complete__') {
            return device;
        } else {
            return dotProp.get(device, payloadFormat);
        }
    }

    getDevicePayloadList(device) {
        switch (this.rule.type) {
            case 'attribute':
                let list = Object.keys(device.data);
                list = list.filter(e => e !== 'state' && e !== 'config');
                list = list.concat(Object.keys(device.data.state).map(e => 'state.' + e));
                list = list.concat(Object.keys(device.data.config).map(e => 'config.' + e));
                return list;
            case 'state':
            case 'config':
                return Object.keys(device.data[this.rule.type]);
        }
    }

    checkOutputTime(device, payloadFormat) {
        switch (this.rule.output) {
            case 'always':
                return true;
            case 'onchange':
                return device && Array.isArray(device.changed) && (
                    (payloadFormat === undefined && device.changed.length > 0) ||
                    (payloadFormat !== undefined && device.changed.includes(payloadFormat))
                );
            case 'onupdate':
                return device && Array.isArray(device.changed) && device.changed.includes('state.lastupdated');
        }
    }


    formatHomeKit(device, changed, rawEvent, options) {
        //TODO Optimise the button event detection
        //TODO Don't send button event if last updated was not changed / rawEvent Contain buttonevent

        let node = this;
        let state = device.state;
        let config = device.config;
        let deviceMeta = device;

        let no_reponse = false;
        if (state !== undefined && state.reachable !== undefined && state.reachable != null && state.reachable === false) {
            no_reponse = true;
        }
        if (config !== undefined && config.reachable !== undefined && config.reachable != null && config.reachable === false) {
            no_reponse = true;
        }
        if (options !== undefined && "reachable" in options && !options.reachable) {
            no_reponse = true;
        }

        let msg = {};
        let characteristic = {};
        if (state !== undefined) {
            //by types
            if ("type" in deviceMeta && (deviceMeta.type).toLowerCase() === 'window covering device') {
                characteristic.CurrentPosition = Math.ceil(state.bri / 2.55);
                characteristic.TargetPosition = Math.ceil(state.bri / 2.55);
                if (no_reponse) {
                    characteristic.CurrentPosition = "NO_RESPONSE";
                    characteristic.TargetPosition = "NO_RESPONSE";
                }

                //by params
            } else {

                if (state.temperature !== undefined) {
                    characteristic.CurrentTemperature = state.temperature / 100;
                    if (no_reponse) characteristic.CurrentTemperature = "NO_RESPONSE";
                }

                if (state.humidity !== undefined) {
                    characteristic.CurrentRelativeHumidity = state.humidity / 100;
                    if (no_reponse) characteristic.CurrentRelativeHumidity = "NO_RESPONSE";
                }

                if (state.lux !== undefined) {
                    characteristic.CurrentAmbientLightLevel = state.lux;
                    if (no_reponse) characteristic.CurrentAmbientLightLevel = "NO_RESPONSE";
                }

                if (state.fire !== undefined) {
                    characteristic.SmokeDetected = state.fire;
                    if (no_reponse) characteristic.SmokeDetected = "NO_RESPONSE";
                }

                if (state.buttonevent !== undefined) {
                    //https://github.com/dresden-elektronik/deconz-rest-plugin/wiki/Xiaomi-WXKG01LM
                    // Event        Button        Action
                    // 1000            One            initial press
                    // 1001           One            single hold
                    // 1002            One            single short release
                    // 1003            One            single hold release
                    // 1004           One            double short press
                    // 1005            One            triple short press
                    // 1006            One            quad short press
                    // 1010            One            five+ short press

                    //https://github.com/NRCHKB/node-red-contrib-homekit-bridged/blob/master/docs/HAP-Specification-Non-Commercial-Version.pdf
                    // -pressed once (programmable switch event = 0)
                    // -pressed twice (programmable switch event = 1)
                    // -held down (programmable switch event = 2)
                    //TODO replace this code that send invalid codes
                    if ([1002, 2002, 3002, 4002, 5002, 6002].indexOf(state.buttonevent) >= 0) characteristic.ProgrammableSwitchEvent = 0;
                    else if ([1004, 2004, 3004, 4004, 5004, 6004].indexOf(state.buttonevent) >= 0) characteristic.ProgrammableSwitchEvent = 1;
                    else if ([1001, 2001, 3001, 4001, 5001, 6001].indexOf(state.buttonevent) >= 0) characteristic.ProgrammableSwitchEvent = 2;
                    else if ([1005, 2005, 3005, 4005, 5005, 6005].indexOf(state.buttonevent) >= 0) characteristic.ProgrammableSwitchEvent = 3;
                    else if ([1006, 2006, 3006, 4006, 5006, 6006].indexOf(state.buttonevent) >= 0) characteristic.ProgrammableSwitchEvent = 4;
                    else if ([1010, 2010, 3010, 4010, 5010, 6010].indexOf(state.buttonevent) >= 0) characteristic.ProgrammableSwitchEvent = 5;
                    if (no_reponse) characteristic.ProgrammableSwitchEvent = "NO_RESPONSE";

                    //index of btn
                    characteristic.ServiceLabelIndex = Math.floor(state.buttonevent / 1000);
                }

                // if (state.consumption !== null){
                //     characteristic.OutletInUse = state.consumption;
                // }

                if (state.power !== undefined) {
                    characteristic.OutletInUse = state.power > 0;
                    if (no_reponse) characteristic.OutletInUse = "NO_RESPONSE";
                }

                if (state.water !== undefined) {
                    characteristic.LeakDetected = state.water ? 1 : 0;
                    if (no_reponse) characteristic.LeakDetected = "NO_RESPONSE";
                }

                if (state.presence !== undefined) {
                    characteristic.MotionDetected = state.presence;
                    if (no_reponse) characteristic.MotionDetected = "NO_RESPONSE";
                }

                if (state.open !== undefined) {
                    characteristic.ContactSensorState = state.open ? 1 : 0;
                    if (no_reponse) characteristic.ContactSensorState = "NO_RESPONSE";
                }

                if (state.vibration !== undefined) {
                    characteristic.ContactSensorState = state.vibration ? 1 : 0;
                    if (no_reponse) characteristic.ContactSensorState = "NO_RESPONSE";
                }

                if (state.on !== undefined) {
                    characteristic.On = state.on;
                    if (no_reponse) characteristic.On = "NO_RESPONSE";
                }

                if (state.bri !== undefined) {
                    characteristic.Brightness = DeconzHelper.convertRange(state.bri, [0, 255], [0, 100]);
                    if (no_reponse) characteristic.Brightness = "NO_RESPONSE";
                }

                //colors
                // if (state.colormode === 'hs' || state.colormode === 'xy') {
                if (state.hue !== undefined) {
                    characteristic.Hue = DeconzHelper.convertRange(state.hue, [0, 65535], [0, 360]);
                    if (no_reponse) characteristic.Hue = "NO_RESPONSE";
                }

                if (state.sat !== undefined) {
                    characteristic.Saturation = DeconzHelper.convertRange(state.sat, [0, 255], [0, 100]);
                    if (no_reponse) characteristic.Saturation = "NO_RESPONSE";
                }

                // } else if (state.colormode === 'ct') {
                if (state.ct !== undefined) { //lightbulb bug: use hue or ct
                    characteristic.ColorTemperature = DeconzHelper.convertRange(state.ct, [153, 500], [140, 500]);
                    if (no_reponse) characteristic.ColorTemperature = "NO_RESPONSE";
                }
                // }

            }
        }

        //battery status
        if (config !== undefined) {
            if (config.battery !== undefined && config.battery != null) {

                if (device.type !== 'ZHASwitch') { //exclude
                    characteristic.StatusLowBattery = parseInt(device.config.battery) <= 15 ? 1 : 0;
                    if (no_reponse) characteristic.StatusLowBattery = "NO_RESPONSE";
                }
            }
        }

        if (Object.keys(characteristic).length === 0) return null; //empty response

        msg.lastupdated = device.state.lastupdated;
        msg.payload = characteristic;
        return msg;
    }


}

module.exports = OutputMsgFormatter;