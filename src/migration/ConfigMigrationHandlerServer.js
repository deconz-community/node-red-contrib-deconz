const ConfigMigrationHandler = require('./ConfigMigrationHandler');

class ConfigMigrationHandlerServer extends ConfigMigrationHandler {
    get lastVersion() {
        return 1; // Don't forget to update node declaration too
    }

    migrate(controller) {
        this.controller = controller;
        if (this.currentVersion === undefined) this.migrateFromLegacy();
        this.result.new.config_version = this.config_version;
    }

    migrateFromLegacy() {

        // Prior 1.2.0 the apikey was not stored in credentials
        if (this.config.apikey !== undefined) {
            this.result.controller.new['credentials.secured_apikey'] = this.config.apikey;
            this.result.delete.push('apikey');
        }

        this.config_version = 1;
    }

}

module.exports = ConfigMigrationHandlerServer;