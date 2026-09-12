import ConfigMigrationHandler from "./ConfigMigrationHandler.js";

class ConfigMigrationHandlerApi extends ConfigMigrationHandler {
  get lastVersion() {
    return 1; // Don't forget to update node declaration too
  }

  migrate(controller) {
    this.controller = controller;
    this.result.new.config_version = this.config_version;
  }
}

export default ConfigMigrationHandlerApi;
