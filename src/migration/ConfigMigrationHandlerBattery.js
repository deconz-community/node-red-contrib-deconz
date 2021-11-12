const ConfigMigrationHandler = require('./ConfigMigrationHandler');

class ConfigMigrationHandlerBattery extends ConfigMigrationHandler {
    get lastVersion() {
        return 2; // Don't forget to update node declaration too
    }

    migrate(controller) {
        this.controller = controller;
        if (this.currentVersion === undefined) this.migrateFromLegacy();
        if (this.currentVersion === 1) this.migrateHomeKitPayload();
        this.result.new.config_version = this.config_version;
    }

    migrateFromLegacy() {
        super.migrateFromLegacy();
        // Migrate device
        let device = super.migrateDeviceFromLegacy();

        // Migrate output
        this.result.new.outputs = 2;
        this.result.new.output_rules = [
            {
                type: 'config',
                format: 'single',
                onstart: this.config.outputAtStartup !== undefined ? this.config.outputAtStartup : true
            },
            {
                type: 'homekit',
                format: 'single',
                onstart: this.config.outputAtStartup !== undefined ? this.config.outputAtStartup : true,
            }
        ];
        this.result.delete.push('state');
        this.result.delete.push('output');
        this.result.delete.push('outputAtStartup');

        this.config_version = 1;
    }

    migrateHomeKitPayload() {
        super.migrateHomeKitPayload();
        this.config_version = 2;
    }

}

module.exports = ConfigMigrationHandlerBattery;