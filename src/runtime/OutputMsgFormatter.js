const dotProp = require('dot-prop');

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

                    // TODO move this to apply it on each payload
                    // Check if I need to send a message with the output conditions (always, on update, ...)
                    //if (!this.checkOutputTime(device)) continue;

                    if (this.rule.payload.includes('__complete__')) {
                        resultMsgs.push(this.formatDeviceMsg(device, rawEvent, '__complete__'));
                    } else if (this.rule.payload.includes('__each__')) {
                        for (const payloadFormat of this.getDevicePayloadList(device)) {
                            resultMsgs.push(this.formatDeviceMsg(device, rawEvent, payloadFormat));
                        }
                    } else {
                        for (const payloadFormat of this.rule.payload) {
                            resultMsgs.push(this.formatDeviceMsg(device, rawEvent, payloadFormat));
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
        msg.topic = this.config.topic;

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
                msg.payload = 'TODO'; //TODO handle homekit format
                break;
        }

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
                let list = Object.keys(device);
                list.filter(e => e !== 'state' && e !== 'config');
                list.concat(Object.keys(device.state).map(e => 'state.' + e));
                list.concat(Object.keys(device.config).map(e => 'config.' + e));
                break;
            case 'state':
            case 'config':
                return Object.keys(device[this.rule.type]);
        }
    }

    checkOutputTime(device) {
        //TODO this don't work
        switch (this.rule.output) {
            case 'always':
                return true;
            case 'onchange':
                return device && Array.isArray(device.changed) && device.changed.length > 0;
            case 'onupdate':
                return device && Array.isArray(device.changed) && device.changed.includes('lastupdated');
        }
    }
}

module.exports = OutputMsgFormatter;