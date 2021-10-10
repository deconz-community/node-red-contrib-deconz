class ConfigMigrationHandler {
    constructor(config, server) {
        this.config = config;
        this.server = server;
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


    migrateDeviceFromLegacy() {
        // Migrate device
        this.result.new.search_type = 'device';
        this.result.new.query = '{}';
        this.result.new.device_list = [];

        let device;
        if (typeof this.config.device === 'string' && this.config.device !== 'undefined' && this.config.device.length > 0) {
            if (this.config.device.substr(0, 6) === 'group_') {
                device = this.server.device_list.getDeviceByDomainID(
                    'groups',
                    Number(this.config.device.substr(6))
                );
            } else {
                device = this.server.device_list.getDeviceByUniqueID(this.config.device);
            }
        }
        if (device) {
            this.result.new.device_list.push(this.server.device_list.getPathByDevice(device));
        } else {
            this.result.errors.push(`Could not find the device '${this.config.device_name}' with uniqueID '${this.config.device}'.`);
        }
        this.result.delete.push('device');

        return device;
    }

}

module.exports = ConfigMigrationHandler;