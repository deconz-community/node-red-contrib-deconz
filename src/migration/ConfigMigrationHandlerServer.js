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
        super.migrateFromLegacy();

        // Prior 1.2.0 the apikey was not stored in credentials
        if (this.config.apikey !== undefined) {
            this.result.controller.new['credentials.secured_apikey'] = this.config.apikey; // For backend migration
            this.result.new.migration_secured_apikey = this.config.apikey; // For frontend migration
            this.result.delete.push('apikey');
            this.result.info.push('node-red-contrib-deconz/server:tip.secured_apikey_warning_message_update');
        }

        this.config_version = 1;
    }

}

module.exports = ConfigMigrationHandlerServer;