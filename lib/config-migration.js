/**
 *
 */
class ConfigMigration {

    constructor(type, config) {
        this.type = type;
        switch (this.type) {
            case 'deconz-input':
                this.handler = new ConfigMigrationHandlerInput(config);

        }
    }

    migrate(controller) {
        if (!this.handler || !this.handler.migrate) {
            return {error: 'Configuration migration handler not found.'};
        }

        if (!this.handler.isLastestVersion) {
            this.handler.migrate(controller);
            return this.handler.result;
        } else {
            return {notNeeded: true};
        }
    }
}

class ConfigMigrationHandler {
    constructor(config) {
        this.config = config;
        this.config_version = this.config.config_version;
        this.result = {
            new: {},
            delete: [],
            errors: []
        };
    }

    get currentVersion() {
        return this.config_version;
    }

    get isLastestVersion() {
        return this.currentVersion === this.lastVersion;
    }

}

class ConfigMigrationHandlerInput extends ConfigMigrationHandler {
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
        this.result.new.search_type = 'device';
        this.result.new.query = '';
        this.result.new.device_list = [];
        let device = this.controller.getDevice(this.config.device);
        if (device) {
            this.result.new.device_list.push(this.controller.getPathByDevice(device));
        } else {
            this.result.errors.push(`Could not find the device '${this.config.device_name}' with uniqueID '${this.config.device}'.`);
        }
        this.result.delete.push('device');

        // Migrate output
        this.result.new.outputs = 2;
        this.result.new.output_rules = [
            {
                type: 'state',
                payload: [
                    (this.config.state === undefined || this.config.state === '0') ?
                        '__complete__' :
                        this.config.state
                ],
                output: this.config.output !== undefined ? this.config.output : 'always',
                onstart: this.config.outputAtStartup !== undefined ? this.config.outputAtStartup : true
            },
            {type: 'homekit', onstart: true, onerror: true},
        ];
        this.result.delete.push('state');
        this.result.delete.push('output');
        this.result.delete.push('outputAtStartup');

        this.config_version = 1;
    }

}

module.exports = ConfigMigration;