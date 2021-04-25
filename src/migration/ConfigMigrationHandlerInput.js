const ConfigMigrationHandler = require('./ConfigMigrationHandler');

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
        super.migrateFromLegacy();

        // Migrate output
        this.result.new.outputs = 2;
        this.result.new.output_rules = [
            {
                format: 'single',
                type: 'state',
                payload: [
                    (this.config.state === undefined || this.config.state === '0') ?
                        '__complete__' :
                        'state.' + this.config.state
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

module.exports = ConfigMigrationHandlerInput;