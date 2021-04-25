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
            filterPlaceholder: RED._(`${this.NRCD}/server:editor.inputs.device.device.filter`),
            placeholder: RED._(`${this.NRCD}/server:editor.multiselect.none_selected`),
            showClear: true
        });

    }


    async connect() {
        await super.connect();

        this.$elements.refreshButton.on('click', () => {
            this.updateList({useSelectedData: true});
            if (this.mainEditor.options.have.output_rules)
                this.mainEditor.subEditor.output_rules.refresh();
        });

        if (this.mainEditor.options.have.output_rules) {
            this.$elements.list.on('change', () => {
                this.mainEditor.subEditor.output_rules.refresh();
            });
        }

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
