const dotProp = require('dot-prop');
const ConfigMigrationHandlerInput = require('./ConfigMigrationHandlerInput');
const ConfigMigrationHandlerOutput = require('./ConfigMigrationHandlerOutput');
const ConfigMigrationHandlerServer = require('./ConfigMigrationHandlerServer');

class ConfigMigration {

    constructor(type, config) {
        this.type = type;
        switch (this.type) {
            case 'deconz-input':
                this.handler = new ConfigMigrationHandlerInput(config);
                break;
            case 'deconz-output':
                this.handler = new ConfigMigrationHandlerOutput(config);
                break;
            case 'deconz-server':
                this.handler = new ConfigMigrationHandlerServer(config);
                break;
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

    applyMigration(config, controller) {
        let result = this.migrate(config);
        if (result.notNeeded === true) return result;

        // Apply new configuration
        for (const [k, v] of Object.entries(result.new)) {
            dotProp.set(config, k, v);
        }
        result.delete.forEach(k => dotProp.delete(config, k));

        // Apply new data on controller
        for (const [k, v] of Object.entries(result.controller.new)) {
            dotProp.set(controller, k, v);
        }
        result.controller.delete.forEach(k => dotProp.delete(controller, k));


        return result;
    }
}

module.exports = ConfigMigration;