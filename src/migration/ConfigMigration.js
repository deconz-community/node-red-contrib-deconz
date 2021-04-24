const ConfigMigrationHandlerInput = require('./ConfigMigrationHandlerInput');
const ConfigMigrationHandlerOutput = require('./ConfigMigrationHandlerOutput');

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
}

module.exports = ConfigMigration;