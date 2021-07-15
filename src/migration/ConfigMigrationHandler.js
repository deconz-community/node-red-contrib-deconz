class ConfigMigrationHandler {
    constructor(config) {
        this.config = config;
        this.config_version = this.config.config_version;
        this.result = {
            new: {},
            delete: [],
            controller: {
                new: {},
                delete: []
            },
            errors: []
        };
    }

    get currentVersion() {
        return this.config_version;
    }

    get isLastestVersion() {
        return this.currentVersion === this.lastVersion;
    }


    migrateFromLegacy() {
        // Migrate device
        this.result.new.search_type = 'device';
        this.result.new.query = '{}';
        this.result.new.device_list = [];
        // Todo Handle groups
        let device = this.controller.getDevice(this.config.device);
        if (device) {
            this.result.new.device_list.push(this.controller.getPathByDevice(device));
        } else {
            this.result.errors.push(`Could not find the device '${this.config.device_name}' with uniqueID '${this.config.device}'.`);
        }
        this.result.delete.push('device');

    }

}

module.exports = ConfigMigrationHandler;