const Utils = require("./Utils");

class CommandParser {

    constructor(command, message_in, node) {
        this.type = command.type;
        this.domain = command.domain;
        this.arg = command.arg;
        this.message_in = message_in;
        this.node = node;
        this.result = {};

        this.parseArgs();
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

    parseArgs() {
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

    }

    getNodeProperty(property) {
        return Utils.getNodeProperty(property, this.node, this.message_in);
    }

}

module.exports = CommandParser;