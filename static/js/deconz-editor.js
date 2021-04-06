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


}


class DeconzMainEditor extends DeconzEditor {

    constructor(node, options = {}) {
        super(node, $.extend({
            have: {
                query: true,
                device: true,
                output_rules: true,
            }
        }, options));

        this.subEditor = {};

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

        for (const editor of Object.values(this.subEditor)) {
            await editor.init(this);
        }

        let connectPromises = [];
        for (const editor of Object.values(this.subEditor)) {
            connectPromises.push(editor.connect());
        }
        await Promise.all(connectPromises);

    }

    async updateQueryDeviceDisplay(options) {
        let type = this.subEditor.query.$elements.select.typedInput('type');

        switch (type) {
            case 'device':
                await this.subEditor.device.updateList(options);
                break;
            case 'json':
            case 'jsonata':
                await this.subEditor.query.updateList(options);
                break;
        }

        await this.subEditor.device.display(type === 'device');
        await this.subEditor.query.display(type !== 'device');
    }

}


class DeconzDeviceListEditor extends DeconzEditor {

    constructor(node, options = {}) {
        super(node, options);
    }

    get xhrURL() {
        return 'deconz/itemlist';
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
        let result = await $.getJSON(this.xhrURL, params);
        let devices = this.formatItemList(result.items);

        // Remove all previous and/or static (if any) elements from 'select' input element
        list.children().remove();

        this.generateHtmlItemList(devices, this.$elements.list);

        // Rebuild bootstrap multiselect form
        this.$elements.list.multipleSelect('refresh');
        // Enable item selection
        this.$elements.list.multipleSelect('enable');

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
                // TODO move that ?
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
        params.query = this.$elements.select.typedInput('value');
        params.queryType = this.$elements.select.typedInput('type');
        params.nodeID = this.node.id;
        return params;
    }

    async init(mainEditor) {
        await super.init();
        this.mainEditor = mainEditor;
        this.initTypedInput();

        await this.mainEditor.updateQueryDeviceDisplay({
            useSavedData: true
        });
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
            typeField: "node-input-search_type"
        });


    }


    async connect() {
        await super.connect();

        this.$elements.select.on('change', () => this.mainEditor.updateQueryDeviceDisplay({
            useSavedData: true
        }));
        this.$elements.refreshButton.on('click', () => this.updateList());
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
    }


    async connect() {
        await super.connect();

        this.$elements.refreshButton.on('click', () => this.updateList({
            useSelectedData: true
        }));

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
        if (options.useSavedData) {
            this.$elements.list.multipleSelect('setSelects', this.node.device_list);
        } else if (options.useSelectedData && itemsSelected !== undefined) {
            this.$elements.list.multipleSelect('setSelects', itemsSelected);
        }

    }

}

class DeconzOutputRuleListEditor extends DeconzEditor {

    constructor(node, options = {}) {
        super(node, options);
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
        this.ruleEditor = [];

        this.$elements.outputs.val(this.outputs);

        this.$elements.list.editableList({
            addItem: (container, index, opt) => {


                let ruleEditor = new DeconzOutputRuleEditor(this.node);
                return ruleEditor.init(this, index, container, opt.rule)
                    .then(() => {
                        this.ruleEditor.push(ruleEditor);
                        console.log({container, index, opt});
                        console.log("done #" + index);
                    });

                /*
                let currentOutputs = JSON.parse(this.$elements.outputs.val() || "{}");

                console.log(currentOutputs);

                currentOutputs[opt.hasOwnProperty('i') ? opt.i : opt._i] = index;
                this.$elements.outputs.val(JSON.stringify(currentOutputs));

                 */
            },
            removeItem: (opt) => {
                /*
                let currentOutputs = JSON.parse(this.$elements.outputs.val() || "{}");
                if (opt.hasOwnProperty('i')) {
                    currentOutputs[opt.i] = -1;
                } else {
                    delete currentOutputs[opt._i];
                }
                let rules = this.$elements.list.editableList('items');
                rules.each(function (i) {
                    $(this).find(".node-input-output-index").html(i + 1);
                    let data = $(this).data('data');
                    currentOutputs[data.hasOwnProperty('i') ? data.i : data._i] = i;
                });
                this.$elements.outputs.val(JSON.stringify(currentOutputs));

                 */
            },
            resizeItem: (item) => {
                return 200;
            },
            sortItems: (items) => {
                /*
                let currentOutputs = JSON.parse(this.$elements.outputs.val() || "{}");
                let rules = this.$elements.list.editableList('items');
                rules.each(function (i) {
                    $(this).find(".node-input-output-index").html(i + 1);
                    let data = $(this).data('data');
                    currentOutputs[data.hasOwnProperty('i') ? data.i : data._i] = i;
                });
                this.$elements.outputs.val(JSON.stringify(currentOutputs));

                 */
            },
            sortable: true,
            removable: true
        });

        for (let i = 0; i < this.node.output_rules.length; i++) {
            this.$elements.list.editableList('addItem', {rule: this.node.output_rules[i], index: i});
        }

    }


}


class DeconzOutputRuleEditor extends DeconzEditor {

    constructor(node, options = {}) {
        options = $.extend({
            enableEachState: true
        }, options);
        super(node, options);
    }

    get elements() {
        return {
            //list: 'node-input-output-container',
            type: `node-input-output-rule-${this.index}-type`,
            payload: `node-input-output-rule-${this.index}-payload`,
            onstart: `node-input-output-rule-${this.index}-onstart`,
            onerror: `node-input-output-rule-${this.index}-onerror`,
            output: `node-input-output-rule-${this.index}-output`,
        };
    }

    /**
     *
     * @returns {Rule}
     */
    get defaultRule() {
        //{type: 'homekit', onstart: true, onerror: true},
        //{type: 'config', payload: "__complete__", output: "always", onstart: true},

        return {type: 'state', payload: ["__complete__"], output: "always", onstart: true};
    }

    async init(listEditor, index, container, rule) {
        this.listEditor = listEditor;
        this.index = index;


        if (rule.type === undefined) {
            rule = this.defaultRule;
        }


        container.css({
            overflow: 'hidden',
            whiteSpace: 'nowrap'
        });



        await this.generateTypeField(container, rule);
        await this.generatePayloadField(container, rule);
        await this.generateOutputField(container, rule);
        await this.generateOnStartField(container, rule);
        await this.generateOnErrorField(container, rule);

        await super.init();
        await this.initPayloadList();


    }


    async generateTypeField(container, rule) {
        await this.generateSimpleListField(container, {
            id: this.elements.type,
            labelText: "Payload Type",
            labelIcon: "ellipsis-h",
            choices: [
                ['state', 'state'],
                ['config', 'config'],
                ['homekit', 'homekit'],
            ],
            currentValue: rule.type
        });
    }

    async generatePayloadField(container, rule) {
        await this.generateSimpleListField(container, {
            id: this.elements.payload,
            labelText: "Payload",
            labelIcon: "ellipsis-h"
        });


    }

    async initPayloadList() {

        // TODO réutiliser la couleur : $('.red-ui-typedInput-type-select').css('background-color')
        let list = this.$elements.payload;

        list.addClass('multiple-select');
        list.multipleSelect({
            numberDisplayed: 1,
            single: false,
            selectAll: false,
            filter: true,
            container: '.node-input-output-container-row',
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
    }

    async getPayloadList() {
        return $.getJSON('deconz/' + this.$elements.type.val() + 'list', {
            controllerID: this.listEditor.mainEditor.serverNode.id,
            devices: JSON.stringify(this.listEditor.mainEditor.subEditor.device.value)
        });
    }

    async updatePayloadList() {

        this.$elements.payload.multipleSelect('disable');
        this.$elements.payload.children().remove();

        let queryType = this.listEditor.mainEditor.subEditor.query.type;
        let devices = this.listEditor.mainEditor.subEditor.device.value;
        let type = this.$elements.type.val();

        let data = await this.getPayloadList();

        let html = '<option value="__complete__">' + RED._("node-red-contrib-deconz/server:editor.inputs." + type + ".payload.options.complete") + '</option>';
        if (this.options.enableEachState === true) {
            html += '<option value="__each__">' + RED._("node-red-contrib-deconz/server:editor.inputs." + type + ".payload.options.each") + '</option>';
        }

        this.$elements.payload.html(html);

        let groupHtml = $('<optgroup/>', {
            label: RED._("node-red-contrib-deconz/server:editor.inputs." + type + ".payload.group_label")
        });

        Object.keys(data.count).sort().forEach((item) => {
            let sample = data.sample[item];
            let count = data.count[item];
            let label = item;
            if (count !== devices.length) {
                label += " [" + count + "/" + devices.length + "]";
            }
            label += " (" + sample + ")";

            $('<option>' + label + '</option>').attr('value', item).appendTo(groupHtml);
        });

        if (!$.isEmptyObject(data.count)) {
            groupHtml.appendTo(this.$elements.payload);
        }

        //this.$elements.payload
        console.log(this.$elements.type.val());

        // Enable item selection
        this.$elements.payload.multipleSelect('refresh').multipleSelect('enable');

    }

    async generateOutputField(container, rule) {
        await this.generateSimpleListField(container, {
            id: this.elements.output,
            labelText: "Output",
            labelIcon: "sign-out",
            choices: [
                ['always', 'node-red-contrib-deconz/server:editor.inputs.config.output.options.always'],
                ['onchange', 'node-red-contrib-deconz/server:editor.inputs.config.output.options.onchange'],
                ['onupdate', 'node-red-contrib-deconz/server:editor.inputs.config.output.options.onupdate'],
            ],
            currentValue: rule.output
        });
    }

    async generateOnStartField(container, rule) {
        await this.generateCheckboxField(container, {
            id: this.elements.onstart,
            labelText: 'node-red-contrib-deconz/server:editor.inputs.state.start_output.label',
            labelIcon: 'share-square',
            descText: 'node-red-contrib-deconz/server:editor.inputs.state.start_output.text',
            currentValue: rule.onstart,
        });
    }

    async generateOnErrorField(container, rule) {
        await this.generateCheckboxField(container, {
            id: this.elements.onerror,
            labelText: 'node-red-contrib-deconz/server:editor.inputs.homekit.error_output.label',
            labelIcon: 'external-link-square',
            descText: 'node-red-contrib-deconz/server:editor.inputs.homekit.error_output.text',
            currentValue: rule.onerror,
        });
    }

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

        let row = await this.generateInputWithLabel(RED._(options.labelText), RED._(options.labelIcon), input);
        container.append(row);

        if (options.currentValue) input.val(options.currentValue);
    }

    async generateCheckboxField(container, options) {
        let input = $('<input/>', {
            id: options.id,
            //class: 's-width',
            type: 'checkbox',
            style: 'display: inline-block; width: auto !important; vertical-align: top;'
        });

        let row = await this.generateInputWithLabel(RED._(options.labelText), RED._(options.labelIcon), input);

        row.append($('<span/>').html(RED._(options.descText)));

        container.append(row);

        input.attr('checked', options.currentValue);
    }

    async generateInputWithLabel(labelText, labelIcon, input) {
        let row = $('<div/>', {
            class: 'form-row',
            style: 'padding-left:5px;padding-right:15px;'
        });
        let inputID = input.attr('id');
        if (inputID) {
            let labelElement = $('<label/>');
            labelElement.attr('for', inputID);
            labelElement.attr('class', 'l-width');
            if (labelIcon) labelElement.append(`<i class="fa fa-${labelIcon}"></i>`);
            labelElement.append(`<span>${RED._(labelText)}</span>`);
            row.append(labelElement);
        }
        row.append(input);

        return row;
    }

}