import { getProperty, setProperty, hasProperty, deleteProperty } from "dot-prop";
const ConfigMigrationHandlerApi = require("./ConfigMigrationHandlerApi");
const ConfigMigrationHandlerInput = require("./ConfigMigrationHandlerInput");
const ConfigMigrationHandlerGet = require("./ConfigMigrationHandlerGet");
const ConfigMigrationHandlerOutput = require("./ConfigMigrationHandlerOutput");
const ConfigMigrationHandlerBattery = require("./ConfigMigrationHandlerBattery");
const ConfigMigrationHandlerServer = require("./ConfigMigrationHandlerServer");

class ConfigMigration {
  constructor(type, config, server) {
    this.type = type;
    switch (this.type) {
      case "deconz-api":
        this.handler = new ConfigMigrationHandlerApi(config, server);
        break;
      case "deconz-input":
        this.handler = new ConfigMigrationHandlerInput(config, server);
        break;
      case "deconz-get":
        this.handler = new ConfigMigrationHandlerGet(config, server);
        break;
      case "deconz-output":
        this.handler = new ConfigMigrationHandlerOutput(config, server);
        break;
      case "deconz-battery":
        this.handler = new ConfigMigrationHandlerBattery(config, server);
        break;
      case "deconz-server":
        this.handler = new ConfigMigrationHandlerServer(config, server);
        break;
    }
  }

  migrate(config) {
    if (this.handler === undefined || !this.handler.migrate) {
      return {
        errors: [
          `Configuration migration handler not found for node type '${this.type}'.`,
        ],
      };
    }

    if (!this.handler.isLastestVersion) {
      this.handler.migrate(config);

      if (
        Array.isArray(this.handler.result.errors) &&
        this.handler.result.errors.length === 0
      ) {
        this.handler.result.info.push("Configuration migration OK.");
      }

      this.handler.result.info.push(
        "Update the node configuration to hide this message."
      );
      return this.handler.result;
    } else {
      return { notNeeded: true };
    }
  }

  applyMigration(config, node) {
    let result = this.migrate(config);
    if (
      (Array.isArray(result.errors) && result.errors.length > 0) ||
      result.notNeeded === true
    )
      return result;

    // Apply new configuration
    for (const [k, v] of Object.entries(result.new)) {
      setProperty(config, k, v);
    }
    result.delete.forEach((k) => deleteProperty(config, k));

    // Apply new data on controller
    for (const [k, v] of Object.entries(result.controller.new)) {
      setProperty(node, k, v);
    }
    result.controller.delete.forEach((k) => deleteProperty(node, k));

    return result;
  }
}

module.exports = ConfigMigration;
