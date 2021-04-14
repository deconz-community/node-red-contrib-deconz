/**
 * @typedef {Object} Device
 * @property {String} device_name
 * @property {String} resource
 * @property {String} uniqueid
 * @property {Object} query
 * @property {String} path
 * @property {Boolean|undefined} query_match
 */

/**
 * @typedef {Object} DeviceMeta
 * @property {String} device_type - The domain of the device
 * @property {Number} device_id - The id of the device
 */


/**
 * @typedef {Object & Device} Light
 * @property {LightMeta} meta
 */

/**
 * @typedef {Object & DeviceMeta} LightMeta
 * @property {Number} colorcapabilities - The color capabilities as reported by the light.
 * @property {Number} ctmax - The maximum mired color temperature value a device supports.
 * @property {Number} ctmin - The minimum mired color temperature value a device supports.
 * @property {String} lastannounced - Last time the device announced itself to the network.
 * @property {String} lastseen - Last time the device has transmitted any data.
 * @property {String} etag - HTTP etag which changes on any action to the light.
 * @property {String} manufacturername - The manufacturer of the light device.
 * @property {String} modelid - An identifier unique to the product.
 * @property {String} name - Name of a light.
 * @property {Number} powerup - SETTABLE. Brightness to set after power on (limited to DE devices).
 * @property {String} swversion - Firmware version.
 * @property {String} type - Human readable type of the light.
 * @property {Object<string,String|Number|Boolean|Array>} state - The current state of the light.
 * @property {String} uniqueid - The unique id of the light. It consists of the MAC address of the light followed by a dash and an unique endpoint identifier in the range 01 to FF.
 */


/**
 * @typedef {Object & Device} Sensor
 * @property {SensorMeta} meta
 */

/**
 * @typedef {Object & DeviceMeta} SensorMeta
 * @property {Object<string,*>} config
 * @property {Number} ep
 * @property {String} etag
 * @property {String} lastseen
 * @property {String} manufacturername
 * @property {String} modelid
 * @property {String} name
 * @property {Object<string,*>} state
 * @property {String} swversion
 * @property {String} type
 * @property {String} uniqueid - The unique id of the light. It consists of the MAC address of the light followed by a dash and an unique endpoint identifier in the range 01 to FF.
 */


/**
 * @typedef {Object} Group
 * @property {String} device_name
 * @property {String} resource
 * @property {GroupMeta} meta
 * @property {Object} query
 * @property {Boolean|undefined} query_match
 * @property {String} path
 */


/**
 * @typedef {Object & DeviceMeta} GroupMeta
 * @property {Object<string,String|Number|Boolean|Array>} action
 * @property {Object<string,String|Number|Boolean|Array>} state
 * @property {Array} devicemembership
 * @property {String} etag
 * @property {String} id
 * @property {String} name
 * @property {String} type
 * @property {Array<String>} lights
 * @property {Array} scenes
 */


/**
 * @typedef {Object} Rule
 * @property {String} type - Can be 'state', 'config', 'homekit'
 * @property {String[]} [payload] - Can be '[__complete__'], ['__each__'] or any state/config value in an array.
 * @property {Boolean} onstart
 * @property {Boolean} [onerror]
 * @property {String} [output] - Can be 'always', 'onchange' or 'onupdate'
 */

/**
 *  @property {Object.<string, JQuery>} $elements
 */

const NRCD = 'node-red-contrib-deconz';

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
            let id = this.elements[k];
            if (id.charAt(0) !== '#' && id.charAt(0) !== '.') id = '#' + id;
            this.$elements[k] = $(id);
        });
    }


    async init() {
        this.findElements();
    }

    async connect() {
    }

    sendError(msg, timeout = 10000) {
        let myNotification = RED.notify(msg, {
            timeout: timeout,
            type: 'error',
            buttons: [{
                'text': 'okay',
                'class': 'primary',
                'click': () => myNotification.close()
            }]
        });
    }

}


class DeconzMainEditor extends DeconzEditor {

    constructor(node, options = {}) {
        super(node, $.extend(true, {
            have: {
                query: true,
                device: true,
                output_rules: true
            },
            output_rules: {
                type: {
                    state: true,
                    config: true,
                    state_config: true,
                    homekit: false
                }
            }
        }, options));

        this.subEditor = {};
        this.initDone = false;

        // TODO pourquoi le device dois être init avant le query ???
        if (this.options.have.device) this.subEditor.device = new DeconzDeviceEditor(this.node, this.options.device);
        if (this.options.have.query) this.subEditor.query = new DeconzQueryEditor(this.node, this.options.query);
        if (this.options.have.output_rules) this.subEditor.output_rules = new DeconzOutputRuleListEditor(this.node, this.options.output_rules);


    }

    get elements() {
        return {
            server: 'node-input-server',
        };
    }


    async configurationMigration() {
        // Check if we need configuration migration
        if ((this.node.config_version || 0) >= this.node._def.defaults.config_version.value) {
            return;
        }

        let config = {};
        for (const key of Object.keys(this.node._def.defaults)) {
            config[key] = this.node[key];
        }

        let data = {
            type: this.node.type,
            config: JSON.stringify(config)
        };

        let errorMsg = 'Error while migrating the configuration of the node from version ' +
            (this.node.config_version || 0) +
            ' to version ' +
            this.node._def.defaults.config_version.value +
            '.';

        let result = await $.getJSON(`${NRCD}/configurationMigration`, data).catch((t, u) => {
            this.sendError(errorMsg);
        });

        if (result.notNeeded) return;

        if (result.new) {
            for (const [key, value] of Object.entries(result.new)) {
                this.node[key] = value;
            }
        }

        if (result.delete && Array.isArray(result.delete)) {
            for (const key of result.delete) {
                delete this.node[key];
            }
        }

        if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
            this.sendError(errorMsg + '<br><li>' + result.errors.join('</li><li>') + '</li>');
        }
    }


    async init() {
        /*
         * We need small timeout, too fire change event for server select,
         * it's because the configuration node send bad event on loading.
         * https://github.com/node-red/node-red/issues/2883#issuecomment-786314862
         */
        await new Promise(resolve => setTimeout(resolve, 100));

        await this.configurationMigration();

        // Init Editor
        await super.init();
        this.serverNode = RED.nodes.node(this.$elements.server.val());

        // We save the init promise in the instance to pause the output rule before connecting
        this.initPromises = [];
        for (const editor of Object.values(this.subEditor)) {
            this.initPromises.push(editor.init(this));
        }
        await Promise.all(this.initPromises);
        this.initDone = true;
        delete this.initPromises; // Can this cause issue ?

        let connectPromises = [];
        for (const editor of Object.values(this.subEditor)) {
            connectPromises.push(editor.connect());
        }
        await Promise.all(connectPromises);

        //TODO connect server on change ?

    }

    /**
     * Check if the main sub editors are initialized
     * @returns {Promise<void>}
     */
    async isInitialized() {
        if (!this.initDone) await Promise.all(this.initPromises);
    }

    async updateQueryDeviceDisplay(options) {
        let type = this.subEditor.query.$elements.select.typedInput('type');
        switch (type) {
            case 'device':
                await this.subEditor.device.updateList(options);
                break;
            case 'json':
            case 'jsonata':
                console.log("update ?");
                if (this.subEditor.query.$elements.select.typedInput('validate')) {
                    console.log("yes!");
                    await this.subEditor.query.updateList(options);
                }
                break;
        }

        await this.subEditor.device.display(type === 'device');
        await this.subEditor.query.display(type !== 'device');

    }


    oneditsave() {
        if (this.options.have.output_rules) {
            this.node.outputs = this.node.output_rules.length;
            this.node.output_rules = this.subEditor.output_rules.value;
        }
    }

}


class DeconzDeviceListEditor extends DeconzEditor {

    constructor(node, options = {}) {
        super(node, options);
    }

    get xhrURL() {
        return `${NRCD}/itemlist`;
    }

    get xhrParams() {
        return {
            controllerID: this.mainEditor.serverNode.id,
            forceRefresh: this.options.refresh,
        };
    }

    async display(display = true) {
        if (this.$elements.showHide) {
            if (display) {
                this.$elements.showHide.show();
            } else {
                this.$elements.showHide.hide();
            }
            return this.$elements.showHide.promise();
        }
    }

    /**
     *
     * @param options
     * @returns {Promise<{}>}
     */
    async updateList(options) {
        options = $.extend({
            refresh: true
        }, options);

        /** @type {JQuery} */
        let list = this.$elements.list;

        let params = this.xhrParams;
        params.forceRefresh = options.refresh;

        let result = await $.getJSON(this.xhrURL, params).catch((t, u) => {
            this.sendError(t.status === 400 && t.responseText ? t.responseText : u.toString());
        });

        if (result && result.error_message) {
            console.warn(result.error_message);
        }

        // Remove all previous elements from 'select' input element
        list.children().remove();
        if (result && result.items) {
            let devices = this.formatItemList(result.items);
            this.generateHtmlItemList(devices, this.$elements.list);
        }

        // Rebuild bootstrap multipleSelect form
        list.multipleSelect('refresh');
        // Enable item selection
        if (result && result.items) {
            list.multipleSelect('enable');
        }

    }

    formatItemList(items) {
        let itemList = {};

        Object.values(items).forEach((item) => {
            if (this.filterItem && this.filterItem(item)) return true;

            let device_type = item.meta.type;

            if (itemList[device_type] === undefined) {
                itemList[device_type] = [];
            }

            itemList[device_type].push(item);
        });

        return itemList;
    }

    /**
     *
     * @param {Object.<String, Array<Light | Sensor | Group>>} items
     * @param {JQuery} htmlContainer
     */
    generateHtmlItemList(items, htmlContainer) {
        let queryMode = this.constructor === DeconzQueryEditor;
        for (const [group_key, item_list] of (Object.entries(items)
            .sort((a, b) => {
                // Sort by keys
                let x = a[0].toLowerCase();
                let y = b[0].toLowerCase();
                return x < y ? -1 : x > y ? 1 : 0;
            }))) {
            let groupHtml = $('<optgroup/>').attr('label', group_key);
            for (/** @type {Light | Sensor | Group} */ const item of item_list.sort((a, b) => {
                // Sort by keys
                let x = a.device_name.toLowerCase();
                let y = b.device_name.toLowerCase();
                return x < y ? -1 : x > y ? 1 : 0;
            })) {
                let meta = item.meta;
                let label = meta.name;
                if (meta.device_type === "groups") {
                    label += ' (lights: ' + meta.lights.length;
                    if (meta.scenes.length) {
                        label += ", scenes: " + meta.scenes.length;
                    }
                    label += ")";
                }
                let opt = $('<option>' + label + '</option>')
                    .attr("value", item.path);
                if (queryMode && item.query_match) {
                    opt.attr("selected", '');
                }
                opt.appendTo(groupHtml);
            }
            groupHtml.appendTo(htmlContainer);
        }
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
            select: 'node-input-query',
            list: 'node-input-query_result',
            showHide: '.deconz-query-selector',
            refreshButton: '#force-refresh-query-result',
        };
    }


    get type() {
        return this.$elements.select.typedInput('type');
    }

    set type(val) {
        this.$elements.list.typedInput('type', val);
    }

    get value() {
        return this.$elements.select.typedInput('value');
    }

    set value(val) {
        this.$elements.list.typedInput('value', val);
    }


    get xhrParams() {
        let params = super.xhrParams;
        params.query = this.value;
        params.queryType = this.type;
        params.nodeID = this.node.id;
        return params;
    }

    async init(mainEditor) {
        await super.init();
        this.mainEditor = mainEditor;
        this.initTypedInput();

        this.$elements.list.multipleSelect({
            maxHeight: 300,
            dropWidth: 320,
            width: 320,
            single: false,
            filter: true,
            selectAll: false,
            filterPlaceholder: RED._(`${NRCD}/server:editor.inputs.device.device.filter`),
            numberDisplayed: 1,
            disableIfEmpty: true,
            showClear: false,
            hideOptgroupCheckboxes: true,
            filterGroup: true,
            // Make the select read only, not pretty but multipleSelect don't allow readonly list, disable hide all options
            onClick: (view) => {
                this.$elements.list.multipleSelect(view.selected ? 'uncheck' : 'check', view.value);
            }
        });

        await this.mainEditor.updateQueryDeviceDisplay({
            useSavedData: true
        });
    }

    initTypedInput() {
        let options = [];
        if (this.mainEditor.options.have.device) {
            options.push({
                value: "device",
                label: RED._(`${NRCD}/server:editor.inputs.device.query.options.device`),
                icon: `icons/${NRCD}/deconz.png`,
                hasValue: false
            });
        }

        // Init typed input
        this.$elements.select.typedInput({
            type: "text",
            types: options.concat(this.options.allowedTypes),
            typeField: "#node-input-search_type"
        });
    }

    async connect() {
        await super.connect();
        this.$elements.select.on('change', () => {
            this.mainEditor.updateQueryDeviceDisplay({
                useSavedData: true
            });
            this.mainEditor.subEditor.output_rules.refresh();
        });
        this.$elements.refreshButton.on('click', () => {
            this.updateList();
            this.mainEditor.subEditor.output_rules.refresh();
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
            list: 'node-input-device_list',
            showHide: '.deconz-device-selector',
            refreshButton: '#force-refresh',
        };
    }

    get value() {
        return this.$elements.list.multipleSelect('getSelects');
    }

    set value(val) {
        this.$elements.list.multipleSelect('setSelects', val);
    }

    async init(mainEditor) {
        await super.init();
        this.mainEditor = mainEditor;

        this.$elements.list.multipleSelect({
            maxHeight: 300,
            dropWidth: 320,
            width: 320,
            single: (this.$elements.list.attr('multiple') !== "multiple"),
            filter: true,
            filterPlaceholder: RED._(`${NRCD}/server:editor.inputs.device.device.filter`),
            showClear: true
        });

    }


    async connect() {
        await super.connect();

        this.$elements.refreshButton.on('click', () => {
            this.updateList({
                    useSelectedData: true
                }
            );
            this.mainEditor.subEditor.output_rules.refresh();
        });

        this.$elements.list.on('change', () => {
            this.mainEditor.subEditor.output_rules.refresh();
        });

    }


    filterItem(item) {
        let device_type = item.meta.type;

        // TODO probably removed when allow setting config of sensors
        if (this.options.deviceType && this.options.deviceType !== device_type) {
            return true;
        }

        // Keep only battery powered devices
        if (this.options.batteryFilter &&
            (!("meta" in item) || !("config" in item.meta) || !("battery" in item.meta.config))
        ) {
            return true;
        }

    }


    async updateList(options) {
        options = $.extend({
            useSavedData: false,
            useSelectedData: false
        }, options);

        let itemsSelected;
        if (options.useSelectedData) {
            itemsSelected = this.$elements.list.multipleSelect('getSelects');
        }

        await super.updateList(options);

        if (options.useSavedData && Array.isArray(this.node.device_list)) {
            this.$elements.list.multipleSelect('setSelects', this.node.device_list);
        } else if (options.useSelectedData && Array.isArray(itemsSelected)) {
            this.$elements.list.multipleSelect('setSelects', itemsSelected);
        }

    }

}

class DeconzOutputRuleListEditor extends DeconzEditor {

    constructor(node, options = {}) {
        super(node, options);
        this.rules = {};
    }

    get elements() {
        return {
            outputs: 'node-input-outputs',
            list: 'node-input-output-container',
        };
    }

    async init(mainEditor) {
        await super.init();
        this.mainEditor = mainEditor;

        this.$elements.outputs.val(this.outputs);

        let buttons = [];
        for (const [type, enabled] of Object.entries(this.mainEditor.options.output_rules.type)) {
            if (enabled) {
                let type_name = RED._(`${NRCD}/server:editor.inputs.outputs.type.options.${type}`);
                buttons.push({
                    label: RED._(`${NRCD}/server:editor.inputs.outputs.type.add_button.label`, {type: type_name}),
                    icon: "fa fa-" + RED._(`${NRCD}/server:editor.inputs.outputs.type.add_button.icon`),
                    title: RED._(`${NRCD}/server:editor.inputs.outputs.type.add_button.title`, {type: type_name}),
                    click: () => this.$elements.list.editableList('addItem', {type})
                });
            }
        }

        this.$elements.list.editableList({
            sortable: true,
            removable: true,
            height: 'auto',
            addButton: false,
            buttons: buttons,
            addItem: (row, index, rule) => {
                // Create rule editor
                let ruleEditor = new DeconzOutputRuleEditor(this.node, this, row);
                // Store rule editor reference
                rule.uniqueId = ruleEditor.uniqueId;
                this.rules[rule.uniqueId] = ruleEditor;
                // Init rule editor
                ruleEditor.init(rule, index);
            },
            removeItem: (rule) => {
                if (rule.uniqueId && this.rules[rule.uniqueId]) {
                    let deletedIndex = this.rules[rule.uniqueId].index;
                    // Remove old editor
                    delete this.rules[rule.uniqueId];
                    // Shift index -1 of rules after the deleted one
                    for (const rule of Object.values(this.rules)) {
                        if (rule.index > deletedIndex) rule.index--;
                    }
                } else {
                    throw new Error(`Error while removing the rule, the rule ${rule.uniqueId} does not exist.`);
                }
            },
            sortItems: (items) => {
                // Update rule index
                items.each((index, item) => {
                    if (this.rules[item.attr('id')]) {
                        this.rules[item.attr('id')].index = index;
                    } else {
                        throw new Error(`Error while moving the rule, the rule ${index + 1} does not exist.`);
                    }
                });
            }
        });

        this.$elements.list.editableList('addItems', this.node.output_rules);

    }

    get value() {
        let result = [];
        for (const rule of Object.values(this.rules).sort((a, b) => a.index - b.index)) {
            result.push(rule.value);
        }
        return result;
    }

    refresh() {
        for (const rule of Object.values(this.rules)) {
            rule.updatePayloadList();
        }
    }

}

class DeconzOutputRuleEditor extends DeconzEditor {

    constructor(node, listEditor, container, options = {}) {
        options = $.extend({
            enableEachState: true
        }, options);

        super(node, options);

        this.listEditor = listEditor;
        container.uniqueId();
        this.uniqueId = container.attr('id');
        this.container = container;


    }

    get elements() {
        return {
            //list: 'node-input-output-container',
            type: `node-input-output-rule-${this.uniqueId}-type`,
            payload: `node-input-output-rule-${this.uniqueId}-payload`,
            output: `node-input-output-rule-${this.uniqueId}-output`,
            onstart: `node-input-output-rule-${this.uniqueId}-onstart`,
            onerror: `node-input-output-rule-${this.uniqueId}-onerror`,
            outputButton: `node-input-output-rule-${this.uniqueId}-output-button`
        };
    }

    set value(rule) {
        if (rule.type) this.$elements.type.val(rule.type);
        if (rule.payload) this.$elements.payload.multipleSelect('setSelects', rule.payload);
        if (rule.output) this.$elements.output.val(rule.output);
        if (rule.onstart) this.$elements.onstart.val(rule.onstart);
        if (rule.onerror) this.$elements.onerror.val(rule.onerror);
    }

    get value() {
        let value = {};
        value.type = this.$elements.type.val();

        switch (value.type) {
            case 'state':
            case 'config':
                value.output = this.$elements.output.val();
                value.payload = this.$elements.payload.multipleSelect('getSelects');
                value.onstart = this.$elements.onstart.is(":checked");
                break;
            case 'homekit':
                value.onstart = this.$elements.onstart.is(":checked");
                value.onerror = this.$elements.onerror.is(":checked");
                break;
        }

        return value;
    }

    set index(value) {
        if (value !== undefined && this.$elements && this.$elements.outputButton)
            this.$elements.outputButton.find(".node-input-rule-index").html(value + 1);
        this._index = value;
    }

    get index() {
        return this._index;
    }


    /**
     *
     * @returns {Rule}
     */
    get defaultRule() {
        //{type: 'homekit', onstart: true, onerror: true},
        //{type: 'config', payload: "__complete__", output: "always", onstart: true},

        return {type: 'state', payload: ["__complete__"], output: "always", onstart: true, onerror: true};
    }

    async init(rule, index) {
        this._index = index;

        if (rule === undefined || rule.type === undefined) {
            rule = this.defaultRule;
        }

        await this.generatePayloadTypeField(this.container, rule.type);

        await this.generateOutputButton(this.container);

        await this.generatePayloadField(this.container);
        await this.generateOutputField(this.container, rule.output !== undefined ? rule.output : this.defaultRule.output);
        await this.generateOnStartField(this.container, rule.onstart !== undefined ? rule.onstart : this.defaultRule.onstart);
        await this.generateOnErrorField(this.container, rule.onerror !== undefined ? rule.onerror : this.defaultRule.onerror);

        await super.init();

        await this.listEditor.mainEditor.isInitialized();

        await this.initPayloadList(rule.payload);
        await this.updateShowHide(rule.type);
        await this.connect();

    }

    async connect() {
        await super.connect();
        this.$elements.type.on('change', () => {
            let type = this.$elements.type.val();
            if (['state', 'config', 'state_config'].includes(type)) this.updatePayloadList();
            this.updateShowHide(type);
        });

        // Add button to get connected nodes of the output. This is using not documented API so can be broken at anytime.
        this.$elements.outputButton.on('click', () => {
            try {
                let nodes = RED.nodes.filterLinks({source: this.node, sourcePort: this.index}).map((l) => {
                    let result = l.target.type;
                    if (l.target.name !== "") {
                        return result + ':' + l.target.name;
                    } else if (l.target._def.label !== undefined) {
                        return result + ':' + l.target._def.label();
                    } else {
                        return result;
                    }
                });

                let myNotification = RED.notify(`The output ${this.index + 1} is sending message to ${nodes.length} nodes :<br>${nodes.join('<br>')}`, {
                    modal: true,
                    timeout: 5000,
                    buttons: [{
                        'text': 'okay',
                        'class': 'primary',
                        'click': () => myNotification.close()
                    }]
                });

            } catch (e) {
                this.sendError(`This is using not documented API so can be broken at anytime.<br>Error while getting connected nodes: ${e.toString()}`);
            }

        });
    }

    async updateShowHide(type) {
        switch (type) {
            case 'state':
            case 'config':
                this.$elements.payload.closest('.form-row').show();
                this.$elements.output.closest('.form-row').show();
                //this.$elements.onstart.closest('.form-row').show(); // Always displayed
                this.$elements.onerror.closest('.form-row').hide();
                break;
            case 'homekit':
                this.$elements.payload.closest('.form-row').hide();
                this.$elements.output.closest('.form-row').hide();
                //this.$elements.onstart.closest('.form-row').show(); // Always displayed
                this.$elements.onerror.closest('.form-row').show();
                break;
        }
    }


    async updatePayloadList() {
        this.$elements.payload.multipleSelect('disable');
        this.$elements.payload.children().remove();

        let queryType = this.listEditor.mainEditor.subEditor.query.type;
        let devices = this.listEditor.mainEditor.subEditor.device.value;
        let type = this.$elements.type.val();

        if (type === 'homekit') return;

        let i18n = `${NRCD}/server:editor.inputs.outputs.payload`;

        let html = '<option value="__complete__">' + RED._(`${i18n}.options.complete`) + '</option>';
        if (this.options.enableEachState === true) {
            html += '<option value="__each__">' + RED._(`${i18n}.options.each`) + '</option>';
        }

        this.$elements.payload.html(html);

        if (queryType === 'device') {
            let data = await $.getJSON(`${NRCD}/${type}list`, {
                controllerID: this.listEditor.mainEditor.serverNode.id,
                devices: JSON.stringify(this.listEditor.mainEditor.subEditor.device.value)
            });

            let type_list = (type === 'state_config') ? ['state', 'config'] : [type];

            for (const type of type_list) {
                let groupHtml = $('<optgroup/>', {
                    label: RED._(`${i18n}.group_label.${type}`)
                });

                for (const item of Object.keys(data.count[type]).sort()) {
                    let sample = data.sample[type][item];

                    if (typeof sample === 'string') {
                        sample = `"${sample}"`;
                    } else if (Array.isArray(sample)) {
                        sample = `[${sample.toString()}]`;
                    } else {
                        sample = sample.toString();
                    }

                    let label;
                    let count = data.count[type][item];
                    if (count === devices.length) {
                        label = RED._(`${i18n}.item_list`, {
                            name: item,
                            sample: sample
                        });
                    } else {
                        label = RED._(`${i18n}.item_list_mix`, {
                            name: item,
                            sample: sample,
                            item_count: count,
                            device_count: devices.length
                        });
                    }

                    $('<option>' + label + '</option>').attr('value', item).appendTo(groupHtml);
                }

                if (!$.isEmptyObject(data.count[type])) {
                    groupHtml.appendTo(this.$elements.payload);
                }
            }

        }

        // Enable item selection
        this.$elements.payload.multipleSelect('refresh').multipleSelect('enable');

    }

    async initPayloadList(value) {

        // TODO réutiliser la couleur : $('.red-ui-typedInput-type-select').css('background-color')
        let list = this.$elements.payload;

        list.addClass('multiple-select');
        list.multipleSelect({
            maxHeight: 300,
            dropWidth: 300,
            width: 220,
            numberDisplayed: 1,
            single: false,
            selectAll: false,
            filter: true,
            container: '.node-input-output-container-row',
            /*
            This make sure that you can select (one or more state) or complete or each
             */
            onClick: (view) => {
                if (!view.selected) return;
                switch (view.value) {
                    case '__complete__':
                    case '__each__':
                        list.multipleSelect('setSelects', [view.value]);
                        break;
                    default:
                        list.multipleSelect('uncheck', '__complete__');
                        list.multipleSelect('uncheck', '__each__');
                        break;
                }
            },
            onUncheckAll: () => {
                list.multipleSelect('setSelects', '__complete__');
            },
            onOptgroupClick: (view) => {
                if (!view.selected) return;
                list.multipleSelect('uncheck', '__complete__');
                list.multipleSelect('uncheck', '__each__');
            },
        });

        await this.updatePayloadList();

        if (value) list.multipleSelect('setSelects', value);

    }


    //#region HTML Inputs

    async generatePayloadTypeField(container, value) {
        let i18n = `${NRCD}/server:editor.inputs.outputs.type`;

        let choices = [];
        for (const [type, enabled] of Object.entries(this.mainEditor.options.output_rules.type)) {
            if (enabled) {
                choices.push([type, `${i18n}.options.${type}`]);
            }
        }

        await this.generateSimpleListField(container, {
            id: this.elements.type,
            labelText: `${i18n}.label`,
            labelIcon: `${i18n}.icon`,
            choices: choices,
            currentValue: value
        });
    }


    async generateOutputButton(container) {
        $('<a/>', {
            id: this.elements.outputButton,
            class: 'red-ui-button top-right-badge'
        }).append(
            `&nbsp;&#8594;&nbsp;<span class="node-input-rule-index">${this.index + 1}</span>&nbsp;`
        ).appendTo(container);

    }


    async generatePayloadField(container) {
        let i18n = `${NRCD}/server:editor.inputs.outputs.payload`;
        await this.generateSimpleListField(container, {
            id: this.elements.payload,
            labelText: `${i18n}.label`,
            labelIcon: `${i18n}.icon`
        });
    }

    async generateOutputField(container, value) {
        let i18n = `${NRCD}/server:editor.inputs.outputs.output`;
        await this.generateSimpleListField(container, {
            id: this.elements.output,
            labelText: `${i18n}.label`,
            labelIcon: `${i18n}.icon`,
            choices: [ //TODO remove config from name
                ['always', `${i18n}.options.always`],
                ['onchange', `${i18n}.options.onchange`],
                ['onupdate', `${i18n}.options.onupdate`],
            ],
            currentValue: value
        });
    }

    async generateOnStartField(container, value) {
        let i18n = `${NRCD}/server:editor.inputs.outputs.on_start`;
        await this.generateCheckboxField(container, {
            id: this.elements.onstart,
            labelText: `${i18n}.label`,
            labelIcon: `${i18n}.icon`,
            descText: `${i18n}.desc`,
            currentValue: value,
        });
    }

    async generateOnErrorField(container, value) {
        let i18n = `${NRCD}/server:editor.inputs.outputs.on_error`;
        await this.generateCheckboxField(container, {
            id: this.elements.onerror,
            labelText: `${i18n}.label`,
            labelIcon: `${i18n}.icon`,
            descText: `${i18n}.desc`,
            currentValue: value,
        });
    }

    //#endregion

    //#region HTML Helpers

    async generateSimpleListField(container, options) {
        let input = $('<select/>', {id: options.id});

        if (options.choices) {
            for (const [key, value] of options.choices) {
                input.append($('<option/>')
                    .attr('value', key)
                    .html(RED._(value))
                );
            }
        }

        let row = await this.generateInputWithLabel(options.labelText, options.labelIcon, input);
        container.append(row);

        if (options.currentValue !== undefined) input.val(options.currentValue);
    }

    async generateCheckboxField(container, options) {

        let input = $('<input/>', {
            id: options.id,
            //class: 's-width',
            type: 'checkbox',
            style: 'display: table-cell; width: 14px;vertical-align: top;margin-right: 5px',
            checked: options.currentValue
        });

        let row = await this.generateInputWithLabel(options.labelText, options.labelIcon, input);
        row.append($('<span/>')
            .html(RED._(options.descText))
            .css('display', 'table-cell')
        );

        container.append(row);
    }

    async generateInputWithLabel(labelText, labelIcon, input) {
        let row = $('<div/>', {
            class: 'form-row',
            style: 'padding:5px;margin:0;display:table;'
        });
        let inputID = input.attr('id');
        if (inputID) {
            let labelElement = $('<label/>');
            labelElement.attr('for', inputID);
            labelElement.attr('class', 'l-width');
            labelElement.attr('style', 'display:table-cell;');
            if (labelIcon) labelElement.append(`<i class="fa fa-${RED._(labelIcon)}"></i>&nbsp;`);
            labelElement.append(`<span>${RED._(labelText)}</span>`);
            row.append(labelElement);
        }
        input.css('display', 'table-cell');
        row.append(input);

        return row;
    }

    //#endregion

}