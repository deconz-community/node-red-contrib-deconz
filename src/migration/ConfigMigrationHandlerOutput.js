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

        // TODO Migrate commands

        console.log({old:this.config});


        this.config_version = 1;
    }

}

module.exports = ConfigMigrationHandlerOutput;