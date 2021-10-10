const ConfigMigrationHandler = require('./ConfigMigrationHandler');

class ConfigMigrationHandlerGet extends ConfigMigrationHandler {
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
        let device = super.migrateDeviceFromLegacy();

        // Migrate output
        this.result.new.outputs = 1;
        this.result.new.output_rules = [
            {
                type: 'state',
                format: 'single',
                payload: [
                    (this.config.state === undefined || this.config.state === '0') ?
                        '__complete__' :
                        this.config.state
                ]
            }
        ];
        this.result.delete.push('state');

        this.config_version = 1;
    }

}

module.exports = ConfigMigrationHandlerGet;