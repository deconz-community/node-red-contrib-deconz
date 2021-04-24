const ConfigMigrationHandler = require('./ConfigMigrationHandler');

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
        // Migrate device
        super.migrateFromLegacy();

        let command = {
            arg: {}
        };


        // TODO Migrate commands
        switch (this.config.commandType) {
            case 'deconz_cmd':
                command.new.type = 'deconz_state';
                command.new.domain = (this.config.device.substr(0, 6) === 'group_') ? 'group' : 'light';
                command.target = 'state';
                switch (this.config.command) {
                    case 'on':
                        switch (this.config.payloadType) {
                            case 'deconz_payload':
                                command.arg.on = {
                                    type: 'turn',
                                    value: (this.config.payload === '1')
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
                                        type: 'turn',
                                        value: true
                                    };
                                } else if (this.config.payload === 'false') {
                                    command.arg.on = {
                                        type: 'turn',
                                        value: false
                                    };
                                } else {
                                    this.errors.push(`Invalid value '${this.config.payload}' for option Switch (true/false)`);
                                }
                                break;
                            case 'num':
                                if (this.config.payload === '1') {
                                    command.arg.on = {
                                        type: 'turn',
                                        value: true
                                    };
                                } else if (this.config.payload === '0') {
                                    command.arg.on = {
                                        type: 'turn',
                                        value: false
                                    };
                                } else {
                                    this.errors.push(`Invalid value '${this.config.payload}' for option Switch (true/false)`);
                                }
                                break;
                            default:
                                this.errors.push(`Invalid value type '${this.config.payloadType}' for option Switch (true/false)`);
                                break;
                        }
                        break;

                    case 'toggle':
                        command.arg.on = {
                            type: 'toogle'
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
                                if (isNaN(this.config.payload)) {
                                    this.errors.push(`Invalid value '${this.config.payload}' for option '${this.config.command}'`);
                                } else {
                                    command.arg[this.config.command].value = parseInt(this.config.payload);
                                }
                                break;
                            default:
                                this.errors.push(`Invalid value type '${this.config.payloadType}' for option '${this.config.command}'`);
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
                                        if (isNaN(this.config.payload)) {
                                            this.errors.push(`Invalid value '${this.config.payload}' for option 'ct'`);
                                        } else {
                                            command.arg.ct.type = 'num';
                                            command.arg.ct.value = parseInt(this.config.payload);
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
                                if (isNaN(this.config.payload)) {
                                    this.errors.push(`Invalid value '${this.config.payload}' for option 'ct'`);
                                } else {
                                    command.arg.ct.value = parseInt(this.config.payload);
                                }
                                break;
                            default:
                                this.errors.push(`Invalid value type '${this.config.payloadType}' for option 'ct'`);
                                break;
                        }
                        break;
                    case 'xy':
                        switch (this.config.payloadType) {
                            case 'msg':
                            case 'flow':
                            case 'global':
                                command.arg.xy.type = this.config.payloadType;
                                command.arg.xy.value = this.config.payload;
                                break;
                            default:
                                this.errors.push(`Invalid value type '${this.config.payloadType}' for option 'xy'`);
                                break;
                        }
                        break;

                    case 'scene':
                        // TODO
                        break;

                    case 'alert':
                        switch (this.config.payloadType) {
                            case 'deconz_payload':
                                switch (this.config.payload) {
                                    case 'none':
                                    case 'select':
                                    case 'lselect':
                                        command.arg.alert.type = this.config.payload;
                                        break;
                                    default:
                                        this.errors.push(`Invalid value type '${this.config.payloadType}' for option 'alert'`);
                                        break;
                                }
                                break;
                            case 'msg':
                            case 'flow':
                            case 'global':
                                command.arg.alert.type = this.config.payloadType;
                                command.arg.alert.value = this.config.payload;
                                break;
                            case 'str':
                            case 'num':
                                command.arg.alert.type = 'str';
                                command.arg.alert.value = this.config.payload.toString();
                                break;
                            default:
                                this.errors.push(`Invalid value type '${this.config.payloadType}' for option 'alert'`);
                                break;
                        }
                        break;

                    case 'effect':
                        switch (this.config.payloadType) {
                            case 'deconz_payload':
                                switch (this.config.payload) {
                                    case 'none':
                                    case 'colorloop':
                                        command.arg.effect.type = this.config.payload;
                                        break;
                                    default:
                                        this.errors.push(`Invalid value type '${this.config.payloadType}' for option 'effect'`);
                                        break;
                                }
                                break;
                            case 'msg':
                            case 'flow':
                            case 'global':
                                command.arg.effect.type = this.config.payloadType;
                                command.arg.effect.value = this.config.payload;
                                break;
                            case 'str':
                            case 'num':
                                command.arg.effect.type = 'str';
                                command.arg.effect.value = this.config.payload.toString();
                                break;
                            default:
                                this.errors.push(`Invalid value type '${this.config.payloadType}' for option 'effect'`);
                                break;
                        }
                        break;

                    case'colorloopspeed':
                        switch (this.config.payloadType) {
                            case 'msg':
                            case 'flow':
                            case 'global':
                                command.arg.ct.type = this.config.payloadType;
                                command.arg.ct.value = this.config.payload;
                                break;
                            case 'str':
                            case 'num':
                                command.arg.ct.type = 'num';
                                if (isNaN(this.config.payload)) {
                                    this.errors.push(`Invalid value '${this.config.payload}' for option 'ct'`);
                                } else {
                                    command.arg.ct.value = parseInt(this.config.payload);
                                }
                                break;
                            default:
                                this.errors.push(`Invalid value type '${this.config.payloadType}' for option 'ct'`);
                                break;
                        }
                        break;
                }

                break;

            case 'homekit':
                command.new.type = 'homekit';
                switch (this.config.payloadType) {
                    case 'msg':
                        command.arg.on = {
                            type: this.config.payloadType,
                            value: this.config.payload
                        };
                        break;
                    case 'flow':
                    case 'global':
                    case 'str':
                    case 'num':
                        command.errors.push(`The type '${this.config.payloadType}' was not valid in legacy version, he has been converted to 'msg'.`);
                        command.arg.on = {
                            type: 'msg',
                            value: this.config.payload
                        };
                        break;
                    default:
                        this.errors.push(`Invalid value type '${this.config.payloadType}' for option Switch (true/false)`);
                        break;
                }
                break;

            case 'str' :
                command.new.type = 'custom';
                command.new.arg.target = 'state';
                command.new.arg.command = {
                    type: 'str',
                    value: this.config.command
                };
                command.new.arg.payload = {
                    type: this.config.payloadType,
                    value: this.config.payload
                };
                break;
            case 'msg':
                command.new.type = 'custom';
                command.new.arg.target = 'state';
                command.new.arg.command = {
                    type: 'msg',
                    value: this.config.command
                };
                command.new.arg.payload = {
                    type: this.config.payloadType,
                    value: this.config.payload
                };
                break;
            case 'object':
                command.new.type = 'custom';
                command.new.arg.target = 'state';
                command.new.arg.command = {type: 'object'};
                command.new.arg.payload = {
                    type: this.config.payloadType,
                    value: this.config.payload
                };
                break;
            default:
                throw new Error('Invalid command type for migration');
        }

        console.log({old: this.config});

        this.result.commands = [command];
        this.config_version = 1;
    }

}

module.exports = ConfigMigrationHandlerOutput;