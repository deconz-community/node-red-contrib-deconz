class ConfigMigrationHandler {
    constructor(config) {
        this.config = config;
        this.config_version = this.config.config_version;
        this.result = {
            new: {},
            delete: [],
            errors: []
        };
    }

    get currentVersion() {
        return this.config_version;
    }

    get isLastestVersion() {
        return this.currentVersion === this.lastVersion;
    }

}

module.exports = ConfigMigrationHandler;