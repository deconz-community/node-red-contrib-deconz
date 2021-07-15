class DeconzOutputRuleEditor extends DeconzListItemEditor {

    constructor(node, listEditor, container, options = {}) {
        options = $.extend({
            enableEachState: true
        }, options);
        super(node, listEditor, container, options);
    }

    get elements() {
        let keys = [
            'format',
            'type',
            'payload',
            'output',
            'onstart',
            'onerror',
            'outputButton'
        ];

        let elements = {};
        for (const key of keys) {
            elements[key] = `node-input-output-rule-${this.uniqueId}-${key}`;
        }
        return elements;
    }

    get value() {
        let value = {};
        value.type = this.$elements.type.val();

        switch (value.type) {
            case 'attribute':
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


    /**
     *
     * @returns {Rule}
     */
    get defaultRule() {
        //{type: 'homekit', onstart: true, onerror: true},
        //{type: 'config', payload: "__complete__", output: "always", onstart: true},

        return {
            type: 'state',
            payload: ["__complete__"],
            format: 'single',
            output: "always",
            onstart: true,
            onerror: true
        };
    }

    async init(rule, index) {
        this._index = index;

        rule = $.extend(true, this.defaultRule, rule);

        await this.generatePayloadTypeField(this.container, rule.type);
        await this.generatePayloadField(this.container);
        await this.generatePayloadFormatField(this.container, rule.format);
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
            if (['attribute', 'state', 'config'].includes(type)) this.updatePayloadList();
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
            case 'attribute':
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

        let i18n = `${this.NRCD}/server:editor.inputs.outputs.payload`;

        let html = '<option value="__complete__">' + RED._(`${i18n}.options.complete`) + '</option>';
        if (this.options.enableEachState === true) {
            html += '<option value="__each__">' + RED._(`${i18n}.options.each`) + '</option>';
        }

        this.$elements.payload.html(html);

        if (queryType === 'device') {
            let data = await $.getJSON(`${this.NRCD}/${type}list`, {
                controllerID: this.listEditor.mainEditor.serverNode.id,
                devices: JSON.stringify(this.listEditor.mainEditor.subEditor.device.value)
            });

            let type_list = (type === 'attribute') ? ['attribute', 'state', 'config'] : [type];

            for (const _type of type_list) {
                let groupHtml = $('<optgroup/>', {
                    label: RED._(`${i18n}.group_label.${_type}`)
                });

                for (const item of Object.keys(data.count[_type]).sort()) {
                    let sample = data.sample[_type][item];

                    if (typeof sample === 'string') {
                        sample = `"${sample}"`;
                    } else if (Array.isArray(sample)) {
                        sample = `[${sample.toString()}]`;
                    } else {
                        sample = sample.toString();
                    }

                    let label;
                    let count = data.count[_type][item];
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

                    $('<option>' + label + '</option>')
                        .attr('value', (type === 'attribute' && _type !== 'attribute') ? `${_type}.${item}` : item)
                        .appendTo(groupHtml);
                }

                if (!$.isEmptyObject(data.count[_type])) {
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
            width: 200,
            numberDisplayed: 1,
            single: false,
            selectAll: false,
            container: '.node-input-output-container-row',
            filter: true,
            filterPlaceholder: RED._(`${this.NRCD}/server:editor.inputs.device.device.filter`),
            placeholder: RED._(`${this.NRCD}/server:editor.multiselect.none_selected`),
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
        let i18n = `${this.NRCD}/server:editor.inputs.outputs.type`;

        let choices = [];
        for (const [type, enabled] of Object.entries(this.listEditor.options.type)) {
            if (enabled) {
                choices.push([type, `${i18n}.options.${type}`]);
            }
        }

        await this.generateSimpleListField(container, {
            id: this.elements.type,
            i18n,
            choices: choices,
            currentValue: value
        });
    }


    async generatePayloadField(container) {
        let i18n = `${this.NRCD}/server:editor.inputs.outputs.payload`;
        await this.generateSimpleListField(container, {
            id: this.elements.payload,
            i18n
        });
    }

    async generatePayloadFormatField(container, value) {
        let i18n = `${this.NRCD}/server:editor.inputs.outputs.format`;

        let choices = [];
        for (const [format, enabled] of Object.entries(this.listEditor.options.format)) {
            if (enabled) {
                choices.push([format, `${i18n}.options.${format}`]);
            }
        }

        await this.generateSimpleListField(container, {
            id: this.elements.format,
            i18n,
            choices: choices,
            currentValue: value,
            // hidden: choices.length === 1 TODO Implement ?
        });
    }

    async generateOutputField(container, value) {
        let i18n = `${this.NRCD}/server:editor.inputs.outputs.output`;
        await this.generateSimpleListField(container, {
            id: this.elements.output,
            i18n,
            choices: [ //TODO remove config from name
                ['always', `${i18n}.options.always`],
                ['onchange', `${i18n}.options.onchange`],
                ['onupdate', `${i18n}.options.onupdate`],
            ],
            currentValue: value
        });
    }

    async generateOnStartField(container, value) {
        let i18n = `${this.NRCD}/server:editor.inputs.outputs.on_start`;
        await this.generateCheckboxField(container, {
            id: this.elements.onstart,
            i18n,
            currentValue: value,
        });
    }

    async generateOnErrorField(container, value) {
        let i18n = `${this.NRCD}/server:editor.inputs.outputs.on_error`;
        await this.generateCheckboxField(container, {
            id: this.elements.onerror,
            i18n,
            currentValue: value,
        });
    }

    //#endregion

}
