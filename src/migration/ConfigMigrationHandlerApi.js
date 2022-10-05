const ConfigMigrationHandler = require("./ConfigMigrationHandler");

class ConfigMigrationHandlerApi extends ConfigMigrationHandler {
  get lastVersion() {
    return 1; // Don't forget to update node declaration too
  }

  migrate(controller) {
    this.controller = controller;
    this.result.new.config_version = this.config_version;
  }
}

module.exports = ConfigMigrationHandlerApi;
