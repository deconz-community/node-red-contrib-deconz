((exports) => {

    let _lastVersion = 1;

    exports.ConfigMigration = class {

        constructor(currentVersion) {
            this.currentVersion = currentVersion;
        }

        get lastVersion() {
            return _lastVersion;
        }

        isLastestVersion() {
            return this.currentVersion === this.lastVersion;
        }

        migrate(node, config) {
            if (this.currentVersion === undefined) {


            }

            return {node, config};
        }


    };

})(typeof exports === 'undefined' ? this.deconz = {} : exports);