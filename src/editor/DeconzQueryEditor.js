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
            selectAll: false,
            filter: true,
            filterPlaceholder: RED._(`${this.NRCD}/server:editor.inputs.device.device.filter`),
            placeholder: RED._(`${this.NRCD}/server:editor.multiselect.none_selected`),
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
                label: RED._(`${this.NRCD}/server:editor.inputs.device.query.options.device`),
                icon: `icons/${this.NRCD}/icon-color.png`,
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
