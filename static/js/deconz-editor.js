class DeconzEditor {

    constructor(node, options = {}) {
        this.node = node;
        this.options = options;
    }

    get elements() {
        return {};
    }

    findElements() {
        this.$elements = {};
        Object.keys(this.elements).forEach(k => {
            if (typeof this.elements[k] === 'string') {
                this.$elements[k] = $(this.elements[k]);
            } else if (this.options.have[k]) {
                this.$elements[k] = {};
                Object.keys(this.elements).forEach(l => {
                    this.$elements[k][l] = $(this.elements[k][l]);
                });
            }
        });
    }


    async init() {
        this.findElements();
    }

    async connect() {
    }

    display(display = true) {
        if (this.$elements.showHide) {
            if (display) {
                this.$elements.showHide.show();
            } else {
                this.$elements.showHide.hide();
            }
            return this.$elements.showHide.promise();
        }
    }


}


class DeconzMainEditor extends DeconzEditor {

    constructor(node, options = {}) {
        super(node, $.extend({
            have: {
                query: true,
                device: true,
            }
        }, options));

        this.subEditor = {};
        this.initPromises = [];

        if (this.options.have.device) {
            this.subEditor.device = new DeconzDeviceEditor(this.node, this.options.device);
        }
        if (this.options.have.query) {
            this.subEditor.query = new DeconzQueryEditor(this.node, this.options.query);
        }

    }

    get elements() {
        return {
            server: '#node-input-server',
        };
    }


    async init() {
        /*
         * We need small timeout, too fire change event for server select,
         * it's because the configuration node send bad event on loading.
         * https://github.com/node-red/node-red/issues/2883#issuecomment-786314862
         */
        await new Promise(resolve => setTimeout(resolve, 100));

        // Init Editor
        await super.init();
        this.serverNode = RED.nodes.node(this.$elements.server.val());

        let initPromises = [];
        Object.keys(this.subEditor).forEach(k => {
            initPromises.push(this.subEditor[k].init(this));
        });
        await Promise.all(initPromises);

        let connectPromises = [];
        Object.keys(this.subEditor).forEach(k => {
            connectPromises.push(this.subEditor[k].connect());
        });
        await Promise.all(connectPromises);

    }
}


class DeconzDeviceListEditor extends DeconzEditor {


    constructor(node, options = {}) {
        super(node, options);
    }


    async updateList(options) {
        let itemsSelected = [];
        options = $.extend({
            refresh: true,
            useSavedData: false,
            useSelectedData: false,
            callback: $.noop
        }, options);

        let queryMode = this.constructor === DeconzQueryEditor;
        

    }
}

class DeconzQueryEditor extends DeconzDeviceListEditor {

    constructor(node, options = {}) {
        super(node, $.extend({
            allowedTypes: ['json', 'jsonata']
        }, options));
    }

    get elements() {
        return {
            select: '#node-input-query',
            result: '#node-input-query_result',
            showHide: '.deconz-query-selector',
            refreshButton: '#force-refresh-query-result',
        };
    }

    async init(mainEditor) {
        await super.init();
        this.mainEditor = mainEditor;
        this.initTypedInput();
    }

    initTypedInput() {

        let options = [];
        if (this.mainEditor.options.have.device) {
            options.push({
                value: "device",
                label: RED._("node-red-contrib-deconz/server:editor.inputs.device.query.options.device"),
                icon: "icons/node-red-contrib-deconz/deconz.png ",
                hasValue: false
            });
        }

        // Init typed input
        this.$elements.select.typedInput({
            type: "text",
            types: options.concat(this.options.allowedTypes),
            typeField: "#node-input-search_type"
        });

        this.updateList().then(() => {
            this.updateDisplay();
        });

    }

    updateDisplay() {
        let type = this.$elements.select.typedInput('type');
        this.display(type !== 'device');
        this.mainEditor.subEditor.device.display(type === 'device');
    }

    async connect() {
        await super.connect();
        this.$elements.select.on('change', (event, type, value) => {
            // See https://github.com/node-red/node-red/issues/2883
            if (type === true) return;

            let t = this.$elements.select.typedInput('type');
            let v = this.$elements.select.typedInput('value');

            this.updateList().then(() => {
                this.updateDisplay();
            });

            /*
            switch (t) {
                case 'device':
                    await this.mainEditor.subEditor.device.updateList();

                    deconz_updateDeviceList(serverNode, node, elements, {}, options);
                    break;
                case 'json':
                case'jsonata':

                    deconz_updateDeviceList(serverNode, node, elements, {
                        queryMode: true
                    }, options);

                    break;
            }
            */


        });
    }
}

class DeconzDeviceEditor extends DeconzDeviceListEditor {

    constructor(node, options = {}) {
        super(node, $.extend({
            deviceType: false,
            batteryFilter: false,
        }, options));
    }

    get elements() {
        return {
            input: '#node-input-device_list',
            showHide: '.deconz-device-selector',
            refreshButton: '#force-refresh',
        };
    }

    async init(mainEditor) {
        await super.init();
        this.mainEditor = mainEditor;
    }


}

