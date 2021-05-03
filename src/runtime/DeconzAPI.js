class DeconzAPI {

    constructor(options) {
        Object.assign({}, this.defaultOptions, options);
        this.ip = options.ip;
        this.port = options.port;
        this.key = options.key;
        this.secured = options.secured;
    }

    get defaultOptions() {
        return {
            secured: false
        };
    }

    get main() {
        return `http${this.secured ? 's' : ''}://${this.ip}:${this.port}/api/${this.key}`;
    }


}


module.exports = DeconzAPI;