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
            errors: [],
            info: []
        };
    }

    get currentVersion() {
        return this.config_version;
    }

    get isLastestVersion() {
        return this.currentVersion === this.lastVersion;
    }

    migrateFromLegacy() {
        this.result.info.push('node-red-contrib-deconz/server:tip.update_2_0_0_or_later');
        this.result.info.push('node-red-contrib-deconz/server:tip.help_discord_github');
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

    migrateHomeKitPayload() {
        let currentRules = this.config.output_rules;
        if (currentRules === undefined) currentRules = this.result.new.output_rules;
        if (Array.isArray(currentRules)) {
            this.result.new.output_rules = currentRules.map((rule) => {
                if (rule.type === 'homekit') {
                    this.result.info.push('node-red-contrib-deconz/server:tip.homekit_payload');
                    rule.payload = ['__auto__'];
                }
                return rule;
            });
        }
    }

}

module.exports = ConfigMigrationHandler;