const ConfigMigrationHandler = require('./ConfigMigrationHandler');
const Utils = require("../runtime/Utils");

class ConfigMigrationHandlerOutput extends ConfigMigrationHandler {
    get lastVersion() {
        return 1; // Don't forget to update node declaration too
    }

    migrate(controller) {
        this.controller = controller;
        if (this.currentVersion === undefined) this.migrateFromLegacy();
        this.result.new.config_version = this.config_version;
    }

    migrateFromLegacy() {
        super.migrateFromLegacy();
        // Migrate device
        let device = this.migrateDeviceFromLegacy();

        let command = {
            arg: {}
        };

        // Change custom string command that have valid deconz_cmd
        if (this.config.commandType === 'str' && [
            'on',
            'toggle',
            'bri', 'hue', 'sat',
            'ct', 'xy',
            'scene', 'alert', 'effect',
            'colorloopspeed'
        ].includes(this.config.command)) {
            this.config.commandType = 'deconz_cmd';
        }

        if (Utils.isDeviceCover(device) && this.config.commandType === 'str' && [
            'open',
            'stop',
            'lift',
            'tilt'
        ].includes(this.config.command)) {
            this.config.commandType = 'deconz_cmd';
        }

        // TODO Migrate commands
        switch (this.config.commandType) {
            case 'deconz_cmd':
                command.type = 'deconz_state';
                if (typeof this.config.device === 'string' &&
                    this.config.device !== 'undefined' &&
                    this.config.device.length > 0 &&
                    this.config.device.substr(0, 6) === 'group_'
                ) {
                    command.domain = 'groups';
                } else if (Utils.isDeviceCover(device)) {
                    command.domain = 'covers';
                } else {
                    command.domain = 'lights';
                }
                command.target = 'state';
                switch (this.config.command) {
                    case 'on':
                        switch (this.config.payloadType) {
                            case 'deconz_payload':
                                command.arg.on = {
                                    type: 'set',
                                    value: (this.config.payload === '1').toString()
                                };
                                break;
                            case 'msg':
                            case 'flow':
                            case 'global':
                                command.arg.on = {
                                    type: this.config.payloadType,
                                    value: this.config.payload
                                };
                                break;
                            case 'str':
                                if (this.config.payload === 'true') {
                                    command.arg.on = {
                                        type: 'set',
                                        value: 'true'
                                    };
                                } else if (this.config.payload === 'false') {
                                    command.arg.on = {
                                        type: 'set',
                                        value: 'false'
                                    };
                                } else {
                                    this.result.errors.push(`Invalid value '${this.config.payload}' for option Switch (true/false)`);
                                }
                                break;
                            case 'num':
                                if (this.config.payload === '1') {
                                    command.arg.on = {
                                        type: 'set',
                                        value: 'true'
                                    };
                                } else if (this.config.payload === '0') {
                                    command.arg.on = {
                                        type: 'set',
                                        value: 'false'
                                    };
                                } else {
                                    this.result.errors.push(`Invalid value '${this.config.payload}' for option Switch (true/false)`);
                                }
                                break;
                            default:
                                this.result.errors.push(`Invalid value type '${this.config.payloadType}' for option Switch (true/false)`);
                                break;
                        }
                        break;

                    case 'toggle':
                        command.arg.on = {
                            type: 'toggle',
                            value: ''
                        };
                        break;

                    case 'bri':
                    case 'hue':
                    case 'sat':
                        command.arg[this.config.command] = {
                            direction: 'set'
                        };
                        switch (this.config.payloadType) {
                            case 'msg':
                            case 'flow':
                            case 'global':
                                command.arg[this.config.command].type = this.config.payloadType;
                                command.arg[this.config.command].value = this.config.payload;
                                break;
                            case 'str':
                            case 'num':
                                command.arg[this.config.command].type = 'num';
                                if (isNaN(parseInt(this.config.payload))) {
                                    this.result.errors.push(`Invalid value '${this.config.payload}' for option '${this.config.command}'`);
                                } else {
                                    command.arg[this.config.command].value = this.config.payload;
                                }
                                break;
                            default:
                                this.result.errors.push(`Invalid value type '${this.config.payloadType}' for option '${this.config.command}'`);
                                break;
                        }
                        break;
                    case 'ct':
                        command.arg.ct = {
                            direction: 'set'
                        };
                        switch (this.config.payloadType) {
                            case 'deconz_payload':
                                command.arg.ct.type = 'deconz';
                                switch (this.config.payload) {
                                    case '153':
                                        command.arg.ct.value = 'cold';
                                        break;
                                    case '320':
                                        command.arg.ct.value = 'white';
                                        break;
                                    case '500':
                                        command.arg.ct.value = 'warm';
                                        break;
                                    default:
                                        if (isNaN(parseInt(this.config.payload))) {
                                            this.result.errors.push(`Invalid value '${this.config.payload}' for option 'ct'`);
                                        } else {
                                            command.arg.ct.type = 'num';
                                            command.arg.ct.value = this.config.payload;
                                        }
                                        break;
                                }
                                break;
                            case 'msg':
                            case 'flow':
                            case 'global':
                                command.arg.ct.type = this.config.payloadType;
                                command.arg.ct.value = this.config.payload;
                                break;
                            case 'str':
                            case 'num':
                                command.arg.ct.type = 'num';
                                if (isNaN(parseInt(this.config.payload))) {
                                    this.result.errors.push(`Invalid value '${this.config.payload}' for option 'ct'`);
                                } else {
                                    command.arg.ct.value = this.config.payload;
                                }
                                break;
                            default:
                                this.result.errors.push(`Invalid value type '${this.config.payloadType}' for option 'ct'`);
                                break;
                        }
                        break;
                    case 'xy':
                        command.arg.xy = {
                            direction: 'set'
                        };
                        switch (this.config.payloadType) {
                            case 'msg':
                            case 'flow':
                            case 'global':
                                command.arg.xy.type = this.config.payloadType;
                                command.arg.xy.value = this.config.payload;
                                break;
                            default:
                                this.result.errors.push(`Invalid value type '${this.config.payloadType}' for option 'xy'`);
                                break;
                        }
                        break;

                    case 'scene':
                        command.domain = 'scene_call';

                        // Strip 'group_' from device name
                        if (typeof this.config.device === 'string' && this.config.device !== 'undefined' && this.config.device.length > 0) {
                            let part = this.config.device.substring(6);
                            if (part.length === 0 || isNaN(parseInt(part))) {
                                this.result.errors.push(`Invalid group ID '${this.config.device}' for calling scene`);
                            } else {
                                command.arg.group = {
                                    type: 'num',
                                    value: String(part)
                                };
                            }
                        }

                        switch (this.config.payloadType) {
                            case 'deconz_payload':
                            case 'str':
                            case 'num':
                                if (isNaN(parseInt(this.config.payload))) {
                                    this.result.errors.push(`Invalid scene ID '${this.config.payload}' for calling scene`);
                                } else {
                                    command.arg.scene = {
                                        type: 'num',
                                        value: this.config.payload
                                    };
                                }
                                break;
                            case 'msg':
                            case 'flow':
                            case 'global':
                                command.arg.scene = {
                                    type: this.config.payloadType,
                                    value: this.config.payload
                                };
                                break;
                            default:
                                this.result.errors.push(`Invalid value type '${this.config.payloadType}' for calling scene`);
                                break;
                        }
                        break;

                    case 'alert':
                        switch (this.config.payloadType) {
                            case 'deconz_payload':
                                switch (this.config.payload) {
                                    case 'none':
                                    case 'select':
                                    case 'lselect':
                                        command.arg.alert = {
                                            type: 'deconz',
                                            value: this.config.payload
                                        };
                                        break;
                                    default:
                                        this.result.errors.push(`Invalid value type '${this.config.payloadType}' for option 'alert'`);
                                        break;
                                }
                                break;
                            case 'msg':
                            case 'flow':
                            case 'global':
                                command.arg.alert = {
                                    type: this.config.payloadType,
                                    value: this.config.payload
                                };
                                break;
                            case 'str':
                            case 'num':
                                command.arg.alert = {
                                    type: 'str',
                                    value: this.config.payload
                                };
                                if (['none', 'select', 'lselect'].includes(command.arg.alert.value))
                                    command.arg.alert.type = 'deconz';
                                break;
                            default:
                                this.result.errors.push(`Invalid value type '${this.config.payloadType}' for option 'alert'`);
                                break;
                        }
                        break;

                    case 'effect':
                        switch (this.config.payloadType) {
                            case 'deconz_payload':
                                switch (this.config.payload) {
                                    case 'none':
                                    case 'colorloop':
                                        command.arg.effect = {
                                            type: 'deconz',
                                            value: this.config.payload
                                        };
                                        break;
                                    default:
                                        this.result.errors.push(`Invalid value type '${this.config.payloadType}' for option 'effect'`);
                                        break;
                                }
                                break;
                            case 'msg':
                            case 'flow':
                            case 'global':
                                command.arg.effect = {
                                    type: this.config.payloadType,
                                    value: this.config.payload
                                };
                                break;
                            case 'str':
                            case 'num':
                                command.arg.effect = {
                                    type: 'str',
                                    value: this.config.payload
                                };
                                if (['none', 'colorloop'].includes(command.arg.effect.value))
                                    command.arg.effect.type = 'deconz';
                                break;
                            default:
                                this.result.errors.push(`Invalid value type '${this.config.payloadType}' for option 'effect'`);
                                break;
                        }
                        break;

                    case 'colorloopspeed':
                        switch (this.config.payloadType) {
                            case 'msg':
                            case 'flow':
                            case 'global':
                                command.arg.colorloopspeed = {
                                    type: this.config.payloadType,
                                    value: this.config.payload
                                };
                                break;
                            case 'str':
                            case 'num':
                                command.arg.colorloopspeed = {type: 'num'};
                                if (isNaN(parseInt(this.config.payload))) {
                                    this.result.errors.push(`Invalid value '${this.config.payload}' for option 'colorloopspeed'`);
                                } else {
                                    command.arg.colorloopspeed.value = this.config.payload;
                                }
                                break;
                            default:
                                this.result.errors.push(`Invalid value type '${this.config.payloadType}' for option 'colorloopspeed'`);
                                break;
                        }
                        break;

                    case 'open':
                    case 'stop':
                        switch (this.config.payloadType) {
                            case 'msg':
                            case 'flow':
                            case 'global':
                                command.arg[this.config.command] = {
                                    type: this.config.payloadType,
                                    value: this.config.payload
                                };
                                break;
                            case 'str':
                                if (['true', 'false'].includes(this.config.payload)) {
                                    command.arg[this.config.command] = {
                                        type: 'set',
                                        value: this.config.payload
                                    };
                                } else {
                                    this.result.errors.push(`Invalid value '${this.config.payload}' for option '${this.config.command}'`);
                                }
                                break;
                            default:
                                this.result.errors.push(`Invalid value type '${this.config.payloadType}' for option '${this.config.command}'`);
                                break;
                        }
                        break;

                    case 'lift':
                        switch (this.config.payloadType) {
                            case 'msg':
                            case 'flow':
                            case 'global':
                            case 'str':
                            case 'num':
                                if (this.config.payload === 'stop') {
                                    command.arg.lift = {type: 'stop'};
                                } else if (isNaN(parseInt(this.config.payload))) {
                                    this.result.errors.push(`Invalid value '${this.config.payload}' for option 'lift'`);
                                } else {
                                    command.arg.lift = {
                                        type: this.config.payloadType,
                                        value: this.config.payload
                                    };
                                }
                                break;
                            default:
                                this.result.errors.push(`Invalid value type '${this.config.payloadType}' for option 'lift'`);
                                break;
                        }
                        break;

                    case 'tilt':
                        switch (this.config.payloadType) {
                            case 'msg':
                            case 'flow':
                            case 'global':
                            case 'str':
                            case 'num':
                                if (isNaN(parseInt(this.config.payload))) {
                                    this.result.errors.push(`Invalid value '${this.config.payload}' for option 'tilt'`);
                                } else {
                                    command.arg.tilt = {
                                        type: this.config.payloadType,
                                        value: this.config.payload
                                    };
                                    if (command.arg.tilt.type === 'str')
                                        command.arg.tilt.type = 'num';
                                }
                                break;
                            default:
                                this.result.errors.push(`Invalid value type '${this.config.payloadType}' for option 'tilt'`);
                                break;
                        }
                        break;
                }

                if (this.config.command !== 'on' &&
                    this.config.command !== 'toggle' &&
                    ![
                        'scene', 'alert', 'effect', 'colorloopspeed',
                        'open', 'stop', 'lift', 'tilt'
                    ].includes(this.config.command)
                )
                    command.arg.on = {type: 'set', value: 'true'};
                if (this.config.command === 'bri' && !isNaN(this.config.payload))
                    command.arg.on = {type: 'set', value: Number(this.config.payload) > 0 ? 'true' : 'false'};
                break;

            case 'homekit':
                command.type = 'homekit';
                switch (this.config.payloadType) {
                    case 'msg':
                        command.arg.payload = {
                            type: this.config.payloadType,
                            value: this.config.payload
                        };
                        break;
                    case 'flow':
                    case 'global':
                    case 'str':
                    case 'num':
                        this.result.errors.push(`The type '${this.config.payloadType}' was not valid in legacy version, he has been converted to 'msg'.`);
                        command.arg.payload = {
                            type: 'msg',
                            value: this.config.payload
                        };
                        break;
                    default:
                        this.result.errors.push(`Invalid value type '${this.config.payloadType}' for homekit command`);
                        break;
                }
                break;

            case 'str':
                command.type = 'custom';
                command.arg.target = {type: 'state'};
                command.arg.command = {
                    type: 'str',
                    value: this.config.command
                };
                command.arg.payload = {
                    type: this.config.payloadType,
                    value: this.config.payload
                };
                break;
            case 'msg':
                command.type = 'custom';
                command.arg.target = {type: 'state'};
                command.arg.command = {
                    type: 'msg',
                    value: this.config.command
                };
                command.arg.payload = {
                    type: this.config.payloadType,
                    value: this.config.payload
                };
                break;
            case 'object':
                command.type = 'custom';
                command.arg.target = {type: 'state'};
                command.arg.command = {type: 'object'};
                command.arg.payload = {
                    type: this.config.payloadType,
                    value: this.config.payload
                };
                break;
            default:
                this.result.errors.push(`Invalid command type '${this.config.commandType}' for migration`);
        }


        switch (this.config.transitionTimeType) {
            case 'msg':
            case 'flow':
            case 'global':
                command.arg.transition = {
                    type: this.config.transitionTimeType,
                    value: this.config.transitionTime
                };
                break;
            case 'str':
            case 'num':
                command.arg.transition = {type: 'num'};
                if (this.config.transitionTime === '') {
                    command.arg.transition.value = '';
                } else if (isNaN(parseInt(this.config.transitionTime))) {
                    this.result.errors.push(`Invalid value '${this.config.transitionTime}' for option 'transition'`);
                } else {
                    command.arg.transition.value = this.config.transitionTime;
                }
                break;
            default:
                if (typeof this.config.transitionTimeType === 'undefined') {
                    command.arg.transition = {type: 'num'};
                } else {
                    this.result.errors.push(`Invalid value type '${this.config.transitionTimeType}' for option 'transition'`);
                }
                break;
        }

        this.result.delete.push('command');
        this.result.delete.push('commandType');
        this.result.delete.push('payload');
        this.result.delete.push('payloadType');
        this.result.delete.push('transitionTime');
        this.result.delete.push('transitionTimeType');

        command.arg.aftererror = {type: 'continue'};
        this.result.new.commands = [command];
        this.result.new.specific = {
            delay: {type: 'num', value: 50},
            result: {type: 'at_end'},
        };
        this.config_version = 1;
    }

}

module.exports = ConfigMigrationHandlerOutput;
