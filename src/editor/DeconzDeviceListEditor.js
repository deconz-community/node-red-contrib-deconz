class DeconzDeviceListEditor extends DeconzEditor {

    constructor(node, options = {}) {
        super(node, options);
    }

    get xhrURL() {
        return `${this.NRCD}/itemlist`;
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
