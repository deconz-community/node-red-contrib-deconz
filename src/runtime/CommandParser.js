const Utils = require("./Utils");
const HomeKitFormatter = require("./HomeKitFormatter");
const dotProp = require("dot-prop");

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
                if (this.message_in.hap !== undefined && this.message_in.hap.session === undefined) {
                    this.node.error("Deconz outptut node received a message that was not initiated by a HomeKit node. " +
                        "Make sure you disable the 'Allow Message Passthrough' in homekit-bridge node or ensure " +
                        "appropriate filtering of the messages.");
                    return null;
                }
                this.valid_domain.push('lights');
                this.valid_domain.push('group');
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

    parseHomekitArgs(deviceMeta) {
        let values = this.getNodeProperty(this.arg.payload);
        let allValues = values;
        if (dotProp.has(this.message_in, 'hap.allChars')) {
            allValues = dotProp.get(this.message_in, 'hap.allChars');
        }

        if (
            deviceMeta.hascolor === true &&
            Array.isArray(deviceMeta.device_colorcapabilities) &&
            !deviceMeta.device_colorcapabilities.includes('unknown')
        ) {
            let checkColorModesCompatibility = (charsName, mode) => {
                if (dotProp.has(values, charsName) && !Utils.supportColorCapability(deviceMeta, mode)) {
                    this.node.warn(
                        `The light '${deviceMeta.name}' don't support '${charsName}' values. ` +
                        `You can use only '${deviceMeta.device_colorcapabilities.toString()}' modes.`
                    );
                }
            };

            checkColorModesCompatibility('Hue', 'hs');
            checkColorModesCompatibility('Saturation', 'hs');
            checkColorModesCompatibility('ColorTemperature', 'ct');
        }

        (new HomeKitFormatter.toDeconz()).parse(values, allValues, this.result, deviceMeta);
        dotProp.set(this.result, 'state.transitiontime', this.getNodeProperty(this.arg.transitiontime));
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
            if (this.valid_domain.length === 0) return requests;
            for (let device of devices) {
                // Skip if device is invalid, should never happen.
                if (device === undefined || device.data === undefined) continue;

                // If the device type do not match the command type skip the device
                if (!(
                    this.valid_domain.includes('any') ||
                    this.valid_domain.includes(device.data.device_type) ||
                    (Utils.isDeviceCover(device.data) === true && this.valid_domain.includes('covers'))
                )) continue;

                // Parse HomeKit values with device Meta
                if (this.type === 'homekit') {
                    this.result = {
                        config: {},
                        state: {}
                    };
                    this.parseHomekitArgs(device.data);
                }

                // Make sure that the endpoint exist
                let deviceTypeEndpoint = deconzApi.url[device.data.device_type];
                if (deviceTypeEndpoint === undefined)
                    throw new Error('Invalid device endpoint, got ' + device.data.device_type);

                // Attribute request
                if (Object.keys(this.result).length > 0) {
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
                                if (typeof device.data.state.on === 'boolean') {
                                    request.params.on = !device.data.state.on;
                                } else {
                                    if (node.error) {
                                        node.error(`[deconz] The light ${device.data.device_path} don't have a 'on' state value.`);
                                    }
                                    delete request.params.on;
                                }
                                break;
                            case 'groups':
                                delete request.params.on;
                                request.params.toggle = true;
                                break;
                        }
                    }
                    if (request.params.open === 'toggle') {
                        if (typeof device.data.state.open === 'boolean') {
                            request.params.open = !device.data.state.open;
                        } else {
                            if (node.error) {
                                node.error(`The cover ${device.data.device_path} don't have a 'open' state value.`);
                            }
                            delete request.params.open;
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
        requests = requests.map((request) => {
            for (const [k, v] of Object.entries(request.params)) {
                if (v === undefined) delete request.params[k];
            }
            return request;
        }).filter((request) => Object.keys(request.params).length > 0);

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