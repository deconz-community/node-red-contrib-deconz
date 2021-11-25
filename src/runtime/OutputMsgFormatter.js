const dotProp = require('dot-prop');
const Utils = require("./Utils");
const HomeKitFormatter = require("./HomeKitFormatter");

class OutputMsgFormatter {

    constructor(rule, node_type, config) {
        this.rule = Object.assign({
            type: 'state',
            payload: ["__complete__"],
            format: 'single',
            output: "always",
            onstart: true,
            onerror: true
        }, rule);
        this.node_type = node_type;
        this.config = config;
    }

    /**
     *
     * @param devices
     * @param rawEvent only for input node
     * @param options
     */
    getMsgs(devices, rawEvent, options) {
        if (!Array.isArray(devices)) devices = [devices];
        //console.log({rule: this.rule, config: this.config, devices, rawEvent});
        let resultMsgs = [];

        // Check if the raw event contains data of the rule type
        if (rawEvent !== undefined) {
            switch (this.rule.type) {
                case 'state':
                case 'config':
                    if (rawEvent[this.rule.type] === undefined) return resultMsgs;
                    break;
                case 'homekit':
                    if (rawEvent.state === undefined && rawEvent.config === undefined) return resultMsgs;
                    break;
            }
        }

        let checkOutputMethod;
        if (this.node_type === 'deconz-input')
            checkOutputMethod = this.checkOutputTimeNodeInput;

        let generateMsgPayload = (device_list) => {
            let result = {};
            let generateOne = (device, payloadFormat) => {
                if (checkOutputMethod === undefined || checkOutputMethod.call(this, device, payloadFormat, options)) {
                    let msg = this.formatDeviceMsg(device, rawEvent, payloadFormat, options);
                    if (msg === null) return;
                    if (result[payloadFormat] === undefined) result[payloadFormat] = [];
                    result[payloadFormat].push(msg);
                }
            };

            for (const device of device_list) {
                if (this.rule.type === 'homekit') {
                    generateOne(device, 'homekit');
                } else if (this.rule.payload.includes('__complete__')) {
                    generateOne(device, '__complete__');
                } else if (this.rule.payload.includes('__each__')) {
                    for (const payloadFormat of this.getDevicePayloadList(device)) {
                        generateOne(device, payloadFormat);
                    }
                } else {
                    for (const payloadFormat of this.rule.payload) {
                        generateOne(device, payloadFormat);
                    }
                }
            }

            return result;
        };

        let src_msg;

        switch (this.rule.format) {
            case 'single':
                for (const [payloadFormat, msgs] of Object.entries(generateMsgPayload(devices))) {
                    resultMsgs = resultMsgs.concat(msgs);
                }
                break;
            case 'array':
                src_msg = options.src_msg;
                options.src_msg = undefined;
                for (const [payloadFormat, msgs] of Object.entries(generateMsgPayload(devices))) {
                    let msg = this.generateNewMsg(src_msg);
                    msg.payload_format = payloadFormat;
                    msg.payload = msgs;
                    msg.payload_count = msgs.length;
                    resultMsgs.push(msg);
                }
                break;
            case 'average' :
            case 'sum':
            case 'min' :
            case 'max' :
                let mergeData;
                let mergeMethod;
                if (this.rule.format === 'average') {
                    let payloadTotal = {};
                    mergeData = (prefix, targetData, targetCount, currentData, mergeMethod) => {
                        for (const [k, v] of Object.entries(currentData)) {
                            if (k === 'device_id') continue;
                            if (typeof v === 'number') {
                                let count = dotProp.get(targetCount, prefix + k, 0) + 1;
                                let total = dotProp.get(payloadTotal, prefix + k, 0) + v;
                                dotProp.set(targetData, prefix + k, total / count);
                                dotProp.set(targetCount, prefix + k, count);
                                dotProp.set(payloadTotal, prefix + k, total);
                            } else if (['state', 'config'].includes(k)) {
                                mergeData(`${k}.`, targetData, targetCount, v, mergeMethod);
                            }
                        }
                    };
                } else {
                    switch (this.rule.format) {
                        case 'sum':
                            mergeMethod = (a, b) => (a + b);
                            break;
                        case 'min' :
                            mergeMethod = Math.min;
                            break;
                        case 'max' :
                            mergeMethod = Math.max;
                            break;
                    }
                    mergeData = (prefix, targetData, targetCount, currentData, mergeMethod) => {
                        for (const [k, v] of Object.entries(currentData)) {
                            if (k === 'device_id') continue;
                            if (typeof v === 'number') {
                                let currentValue = dotProp.get(targetData, prefix + k);
                                let value;
                                if (currentValue !== undefined) {
                                    value = mergeMethod(currentValue, v);
                                } else {
                                    value = v;
                                }
                                let count = dotProp.get(targetCount, prefix + k, 0) + 1;
                                dotProp.set(targetData, prefix + k, value);
                                dotProp.set(targetCount, prefix + k, count);
                            } else if (['state', 'config'].includes(k)) {
                                mergeData(`${k}.`, targetData, targetCount, v, mergeMethod);
                            }
                        }
                    };
                }
                src_msg = options.src_msg;
                options.src_msg = undefined;
                for (const [payloadFormat, msgs] of Object.entries(generateMsgPayload(devices))) {
                    let msg = this.generateNewMsg(src_msg);
                    msg.payload = {};
                    msg.payload_count = {};
                    msg.payload_format = payloadFormat;
                    msg.meta = [];
                    let isSingleValue = false;
                    for (const data of msgs) {
                        msg.meta.push(data.meta);
                        if (typeof data.payload === 'object' && !Array.isArray(data.payload)) {
                            mergeData('', msg.payload, msg.payload_count, data.payload, mergeMethod);
                        } else {
                            isSingleValue = true;
                            mergeData('', msg.payload, msg.payload_count, {value: data.payload}, mergeMethod);
                        }
                    }
                    if (isSingleValue === true) {
                        msg.payload = msg.payload.value;
                        msg.payload_count = msg.payload_count.value;
                    }
                    resultMsgs.push(msg);
                }
                break;
        }

        return resultMsgs;
    }

    generateNewMsg(src_msg) {
        if (src_msg === undefined) return {};
        return Utils.cloneMessage(src_msg, ['payload', 'payload_format', 'payload_raw', 'meta', 'meta_changed']);
    }

    formatDeviceMsg(device, rawEvent, payloadFormat, options) {
        let msg = this.generateNewMsg(options.src_msg);

        // Filter scene call events
        if (typeof rawEvent === 'object' && (
            (rawEvent.e === 'scene-called' && this.rule.type !== 'scene_call') ||
            (rawEvent.e !== 'scene-called' && this.rule.type === 'scene_call')
        )) return null;

        switch (this.rule.type) {
            case 'attribute':
                if (dotProp.has(device, 'data'))
                    msg.payload = this.formatDevicePayload(device.data, payloadFormat, options);
                break;
            case 'state':
                if (dotProp.has(device, 'data.state'))
                    msg.payload = this.formatDevicePayload(device.data.state, payloadFormat, options);
                break;
            case 'config':
                if (dotProp.has(device, 'data.config'))
                    msg.payload = this.formatDevicePayload(device.data.config, payloadFormat, options);
                break;
            case 'homekit':
                if (dotProp.has(device, 'data'))
                    msg = this.formatHomeKit(device.data, device.changed, rawEvent, options);
                break;
            case 'scene_call':
                if (dotProp.has(device, 'data.scenes'))
                    msg.payload = device.data.scenes.filter((v) => v.id === rawEvent.scid).shift();
                break;
        }

        // If we don't have payload drop the msg
        if (msg === null || msg.payload === undefined) return null;

        if (['deconz-input', 'deconz-battery'].includes(this.node_type)) msg.topic = this.config.topic;
        if (payloadFormat !== undefined) msg.payload_format = payloadFormat;
        if (rawEvent !== undefined) msg.payload_raw = rawEvent;
        msg.payload_type = this.rule.type;
        msg.meta = device.data;
        if (device.changed !== undefined) msg.meta_changed = device.changed;

        return msg;
    }

    formatDevicePayload(device, payloadFormat, options) {
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

    checkOutputTimeNodeInput(device, payloadFormat, options) {
        // The On start output are priority
        if (options.initialEvent === true) return true;

        switch (this.rule.output) {
            case 'always':
                return true;
            case 'onchange':
                let payloadPath = payloadFormat;
                if (this.rule.type === 'state' || this.rule.type === 'config')
                    payloadPath = `${this.rule.type}.${payloadPath}`;
                return device && Array.isArray(device.changed) && (
                    (payloadFormat === '__complete__' && device.changed.length > 0) ||
                    (payloadFormat !== '__complete__' && device.changed.includes(payloadPath))
                );
            case 'onupdate':
                return device && Array.isArray(device.changed) && device.changed.includes('state.lastupdated');
        }
    }

    formatHomeKit(device, changed, rawEvent, options) {
        let node = this;

        // Override rawEvent for initialEvent because in this case rawEvent is an empty object
        if (options.initialEvent === true || options.errorEvent === true) {
            rawEvent = device;
        }

        let no_reponse = options.errorEvent === true;

        if (
            (rawEvent.state !== undefined && rawEvent.state.reachable === false) ||
            (rawEvent.config !== undefined && rawEvent.config.reachable === false)
        ) {
            no_reponse = true;
            if (this.rule.onerror === false) {
                return null;
            }
        }

        let msg = {};

        let batteryAttributes = ['BatteryLevel', 'StatusLowBattery'];

        const opts = {
            attributeWhitelist: [],
            attributeBlacklist: []
        };

        if (this.rule.payload.includes('__auto__')) {
            opts.attributeBlacklist = this.node_type === 'deconz-input' ? batteryAttributes : [];
            opts.attributeWhitelist = this.node_type === 'deconz-battery' ? batteryAttributes : [];
        } else {
            opts.attributeWhitelist = this.rule.payload;
        }

        let characteristic = (new HomeKitFormatter.fromDeconz(opts)).parse(rawEvent, device);

        if (no_reponse) {
            for (const name of Object.keys(characteristic)) {
                characteristic[name] = 'NO_RESPONSE';
            }
        }

        if (dotProp.has(device, 'state.lastupdated')) {
            msg.lastupdated = dotProp.get(device, 'state.lastupdated');
        }

        if (Object.keys(characteristic).length === 0) return null; //empty response

        msg.payload = characteristic;
        return msg;
    }

}

module.exports = OutputMsgFormatter;